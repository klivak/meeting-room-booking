import { NextResponse } from "next/server";

import { createBookingSchema } from "@/lib/domain/bookingInput";
import { validateBookingTime, validateTitle } from "@/lib/domain/bookingRules";
import { apiError, unauthorizedError, validationError } from "@/lib/server/apiError";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
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

  const booking = await prisma.$transaction(async (tx) => {
    // Same rule as intervalsOverlap, expressed as a query: an active booking of
    // this room clashes when it starts before ours ends and ends after ours
    // starts. Canceled rows are skipped, so they stop blocking their slot.
    const clash = await tx.booking.findFirst({
      where: {
        roomId,
        canceledAt: null,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      select: { id: true },
    });

    if (clash) {
      return null;
    }

    return tx.booking.create({
      data: {
        roomId,
        userId: user.id,
        title: title.trim(),
        startsAt: start,
        endsAt: end,
      },
      select: { id: true, roomId: true, title: true, startsAt: true, endsAt: true },
    });
  });

  if (!booking) {
    return apiError(409, "SLOT_TAKEN", "Цей час уже зайнятий");
  }

  return NextResponse.json(booking, { status: 201 });
}
