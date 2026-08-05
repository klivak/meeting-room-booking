import { NextResponse } from "next/server";

import {
  apiError,
  emailNotVerifiedError,
  unauthorizedError,
} from "@/lib/server/apiError";
import { restoreBooking } from "@/lib/server/bookings";
import { prisma } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/session";

/**
 * Takes back a cancellation, which is what the "Undo" in the toast calls.
 *
 * It is a separate route rather than a flag on PATCH because it is a different
 * question: PATCH asks for a booking to be given other times, this asks for one
 * to exist again. The slot is free the moment it is canceled, so the answer may
 * legitimately be no — and then it is a 409 like any other taken slot.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  if (!user.emailVerified) {
    return await emailNotVerifiedError();
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return await apiError(404, "NOT_FOUND", "NOT_FOUND");
  }

  // The same ownership rule as everywhere else, spelled out here because the
  // states this route accepts are the mirror image of the ones checkBookingAccess
  // allows: this one wants a canceled booking, that one refuses them.
  if (booking.userId !== user.id) {
    return await apiError(403, "FORBIDDEN", "FORBIDDEN");
  }

  if (booking.canceledAt === null) {
    return await apiError(404, "NOT_FOUND", "NOT_FOUND");
  }

  // Restoring something that is already over would put a booking in the past,
  // which no other route allows either.
  if (booking.endsAt <= new Date()) {
    return await apiError(400, "VALIDATION_ERROR", "BOOKING_FINISHED");
  }

  const restored = await restoreBooking(id, booking.roomId, user.id);
  if (!restored) {
    return await apiError(409, "SLOT_TAKEN", "SLOT_TAKEN");
  }

  return NextResponse.json(restored);
}
