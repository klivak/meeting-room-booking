import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { createBookingSchema } from "@/lib/domain/bookingInput";
import { validateBookingTime, validateTitle } from "@/lib/domain/bookingRules";
import { OFFICE_TZ } from "@/lib/domain/constants";
import { getWeeklyOccurrences } from "@/lib/domain/recurrence";
import {
  apiError,
  emailNotVerifiedError,
  unauthorizedError,
  validationError,
} from "@/lib/server/apiError";
import { createBooking, createBookingSeries } from "@/lib/server/bookings";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  if (!user.emailVerified) {
    return emailNotVerifiedError();
  }

  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { roomId, title, startsAt, endsAt } = parsed.data;

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    return apiError(404, "NOT_FOUND", "Кімнату не знайдено", "roomId");
  }

  const titleError = validateTitle(title);
  if (titleError) {
    return apiError(400, titleError.code, titleError.message, "title");
  }

  const now = new Date();
  const occurrences = getWeeklyOccurrences(
    new Date(startsAt),
    new Date(endsAt),
    parsed.data.repeatWeeks ?? 1,
  );

  // Every occurrence goes through the same rules, so a series cannot smuggle a
  // booking outside working hours into a later week.
  for (const occurrence of occurrences) {
    const [timeError] = validateBookingTime({ ...occurrence, now });
    if (timeError) {
      return apiError(400, timeError.code, timeError.message);
    }
  }

  const write = { roomId, userId: user.id, title: title.trim() };

  if (occurrences.length === 1) {
    const booking = await createBooking({ ...write, ...occurrences[0] });

    return booking
      ? NextResponse.json(booking, { status: 201 })
      : apiError(409, "SLOT_TAKEN", "Цей час уже зайнятий");
  }

  const series = await createBookingSeries(write, occurrences);

  if (series.created === null) {
    // The error format has no room for a list, so the dates go into the message
    // the user reads: knowing which weeks clash is the point of the refusal.
    const dates = series.conflicts
      .map((date) => DateTime.fromJSDate(date).setZone(OFFICE_TZ).toFormat("dd.MM"))
      .join(", ");

    return apiError(409, "SLOT_TAKEN", `Цей час уже зайнятий: ${dates}`);
  }

  return NextResponse.json(series.created[0], { status: 201 });
}
