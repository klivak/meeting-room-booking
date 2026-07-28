/**
 * Bookings are half-open intervals [start, end): the start minute belongs to the
 * booking, the end minute does not. Two intervals clash only when each one
 * starts before the other ends, which makes back-to-back bookings
 * (a.end === b.start) legal while partial overlap, an exact match and
 * containment all clash.
 *
 * The strict "<" is the whole rule: "<=" would wrongly reject 10:00-11:00
 * followed by 11:00-12:00.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
