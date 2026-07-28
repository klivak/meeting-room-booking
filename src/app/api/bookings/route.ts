import { NextResponse } from "next/server";

import { createBookingSchema } from "@/lib/domain/bookingInput";
import { validateBookingTime, validateTitle } from "@/lib/domain/bookingRules";
import {
  apiError,
  emailNotVerifiedError,
  unauthorizedError,
  validationError,
} from "@/lib/server/apiError";
import { createBooking } from "@/lib/server/bookings";
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

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  // The time rules live in the domain layer, so the form and the API cannot drift apart.
  const [timeError] = validateBookingTime({
    startsAt: start,
    endsAt: end,
    now: new Date(),
  });
  if (timeError) {
    return apiError(400, timeError.code, timeError.message);
  }

  const booking = await createBooking({
    roomId,
    userId: user.id,
    title: title.trim(),
    startsAt: start,
    endsAt: end,
  });

  if (!booking) {
    return apiError(409, "SLOT_TAKEN", "Цей час уже зайнятий");
  }

  return NextResponse.json(booking, { status: 201 });
}
