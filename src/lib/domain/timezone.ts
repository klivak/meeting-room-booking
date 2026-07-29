import { DateTime } from "luxon";

/**
 * Whether two timezones are showing the same wall clock at a given moment.
 *
 * Comparing the names would be wrong: browsers still hand out the old aliases,
 * so a user sitting in Kyiv gets "Europe/Kiev" while the office constant says
 * "Europe/Kyiv", and a string comparison would warn them that their clock
 * differs from their own clock.
 *
 * The offset is the honest test, because the offset is exactly what the notice
 * is about: if it matches, the times on the grid already are office times and
 * there is nothing to explain.
 */
export function showsSameClock(zone: string, other: string, at: Date): boolean {
  const here = DateTime.fromJSDate(at).setZone(zone);
  const there = DateTime.fromJSDate(at).setZone(other);

  // An unknown zone name is not the same clock as anything; saying so keeps the
  // notice visible rather than silently hiding it.
  if (!here.isValid || !there.isValid) {
    return false;
  }

  return here.offset === there.offset;
}
