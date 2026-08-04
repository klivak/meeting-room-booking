import { SLOT_MINUTES } from "./constants";

// What a room card says about today. The card exists to answer one question —
// "can I go there now, and if not, when" — so this returns that answer and
// nothing else. The wording lives in the dictionary.

export type RoomAvailability =
  /** Free right now. */
  | { kind: "free" }
  /** Busy now, but there is a free half hour later today, starting at `at`. */
  | { kind: "freeFrom"; at: Date }
  /** Booked solid for the rest of the office day. */
  | { kind: "busyToday" }
  /** The office day is over. */
  | { kind: "closed" };

const SLOT_MS = SLOT_MINUTES * 60 * 1000;

/**
 * The first free moment from now on, given today's bookings for one room.
 *
 * Bookings are half-open intervals, so one that ends exactly when the cursor
 * stands does not push it: back-to-back is not a conflict, and neither is it a
 * reason to say the room is busy.
 */
export function getRoomAvailability(
  bookings: { startsAt: Date; endsAt: Date }[],
  now: Date,
  dayStart: Date,
  dayEnd: Date,
): RoomAvailability {
  if (+now >= +dayEnd) {
    return { kind: "closed" };
  }

  const sorted = [...bookings].sort((a, b) => +a.startsAt - +b.startsAt);
  let cursor = Math.max(+now, +dayStart);

  for (const booking of sorted) {
    if (+booking.startsAt <= cursor) {
      cursor = Math.max(cursor, +booking.endsAt);
    }
  }

  // A gap shorter than one slot cannot be booked, so it is not free time.
  if (cursor + SLOT_MS > +dayEnd) {
    return { kind: "busyToday" };
  }

  return cursor <= +now
    ? { kind: "free" }
    : { kind: "freeFrom", at: new Date(cursor) };
}
