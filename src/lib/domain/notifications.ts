// Rule for the "your room is taken right after you" notification.
//
// It only makes sense when someone else needs the room the moment yours ends:
// if the next slot is free, there is nothing to warn about.

export type NotificationCandidate = {
  booking: { endsAt: Date; canceledAt: Date | null };
  /** Active booking of the same room that starts exactly when this one ends. */
  nextBooking: { startsAt: Date; canceledAt: Date | null } | null;
  now: Date;
  minutesBefore: number;
};

/**
 * Whether the author should be warned right now.
 *
 * Both bookings have to be active: cancelling either one removes the reason for
 * the warning, whether that happens before it is created or after. The window
 * is half-open on the right — once the booking has ended there is nothing left
 * to warn about.
 */
export function isEndingNotificationDue({
  booking,
  nextBooking,
  now,
  minutesBefore,
}: NotificationCandidate): boolean {
  if (booking.canceledAt !== null) {
    return false;
  }

  // Back-to-back is what makes this worth saying: an adjacent booking that
  // starts later leaves the room free for a while.
  if (
    nextBooking === null ||
    nextBooking.canceledAt !== null ||
    nextBooking.startsAt.getTime() !== booking.endsAt.getTime()
  ) {
    return false;
  }

  const warnFrom = booking.endsAt.getTime() - minutesBefore * 60 * 1000;

  return now.getTime() >= warnFrom && now.getTime() < booking.endsAt.getTime();
}
