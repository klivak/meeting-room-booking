import { DateTime } from "luxon";

import { OFFICE_TZ } from "./constants";

// Weekly repetition is the only rule the product needs: same weekday, same
// office wall-clock time, a fixed number of times.

export const MIN_OCCURRENCES = 2;
export const MAX_OCCURRENCES = 12;

export type Occurrence = { startsAt: Date; endsAt: Date };

/**
 * The occurrences of a weekly series, the first one included.
 *
 * Weeks are added in office time rather than by adding 7×24 hours, so a series
 * crossing the switch to summer time keeps its wall-clock time: 10:00 in Kyiv
 * stays 10:00 even though the interval in UTC is an hour shorter that week.
 */
export function getWeeklyOccurrences(
  startsAt: Date,
  endsAt: Date,
  count: number,
): Occurrence[] {
  const start = DateTime.fromJSDate(startsAt).setZone(OFFICE_TZ);
  const end = DateTime.fromJSDate(endsAt).setZone(OFFICE_TZ);

  return Array.from({ length: count }, (_, index) => ({
    startsAt: start.plus({ weeks: index }).toJSDate(),
    endsAt: end.plus({ weeks: index }).toJSDate(),
  }));
}
