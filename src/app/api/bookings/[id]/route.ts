import { NextResponse } from "next/server";

import { updateBookingSchema } from "@/lib/domain/bookingInput";
import {
  checkBookingAccess,
  validateBookingTime,
  validateTitle,
  type BookingAccess,
} from "@/lib/domain/bookingRules";
import { apiError, unauthorizedError, validationError } from "@/lib/server/apiError";
import { updateBooking } from "@/lib/server/bookings";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

/** Maps a refused access reason to the response both handlers return. */
function accessError(access: Exclude<BookingAccess, "allowed">) {
  if (access === "not-owner") {
    return apiError(403, "FORBIDDEN", "Можна змінювати лише власні бронювання");
  }

  if (access === "canceled") {
    return apiError(404, "NOT_FOUND", "Бронювання не знайдено");
  }

  return apiError(400, "VALIDATION_ERROR", "Бронювання вже завершилося");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return apiError(404, "NOT_FOUND", "Бронювання не знайдено");
  }

  const now = new Date();
  const access = checkBookingAccess(booking, user.id, now);
  if (access !== "allowed") {
    return accessError(access);
  }

  // Anything the request omits keeps its current value, and the result is
  // validated as a whole — editing goes through the same rules as creating.
  const nextRoomId = parsed.data.roomId ?? booking.roomId;
  const nextTitle = parsed.data.title ?? booking.title;
  const nextStart = parsed.data.startsAt ? new Date(parsed.data.startsAt) : booking.startsAt;
  const nextEnd = parsed.data.endsAt ? new Date(parsed.data.endsAt) : booking.endsAt;

  if (nextRoomId !== booking.roomId) {
    const room = await prisma.room.findUnique({ where: { id: nextRoomId } });
    if (!room) {
      return apiError(404, "NOT_FOUND", "Кімнату не знайдено", "roomId");
    }
  }

  const titleError = validateTitle(nextTitle);
  if (titleError) {
    return apiError(400, titleError.code, titleError.message, "title");
  }

  const errors = validateBookingTime({ startsAt: nextStart, endsAt: nextEnd, now });

  // Renaming a booking that is already running is allowed, so "must be in the
  // future" only applies when the start time itself moves.
  const startMoved = nextStart.getTime() !== booking.startsAt.getTime();
  const [timeError] = startMoved
    ? errors
    : errors.filter((error) => error.code !== "TIME_IN_PAST");

  if (timeError) {
    return apiError(400, timeError.code, timeError.message);
  }

  const updated = await updateBooking(id, {
    roomId: nextRoomId,
    title: nextTitle.trim(),
    startsAt: nextStart,
    endsAt: nextEnd,
  });

  if (!updated) {
    return apiError(409, "SLOT_TAKEN", "Цей час уже зайнятий");
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedError();
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return apiError(404, "NOT_FOUND", "Бронювання не знайдено");
  }

  const access = checkBookingAccess(booking, user.id, new Date());
  if (access !== "allowed") {
    return accessError(access);
  }

  // Soft delete: the row stays for history but drops out of the grid, the lists
  // and every overlap check.
  await prisma.booking.update({
    where: { id },
    data: { canceledAt: new Date() },
  });

  return new NextResponse(null, { status: 204 });
}
