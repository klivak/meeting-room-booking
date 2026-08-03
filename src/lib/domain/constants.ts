// Domain constants shared by validation, the schedule grid and the seed.
// Everything here is framework- and database-agnostic on purpose.

/** IANA timezone of the office. Working hours are always checked in this zone. */
export const OFFICE_TZ = "Europe/Kyiv";

/** Start of the working day, in office time. */
export const WORK_DAY_START = "09:00";

/** End of the working day, in office time. A booking may end exactly at 19:00. */
export const WORK_DAY_END = "19:00";

/** Grid step: every booking boundary must land on a multiple of this. */
export const SLOT_MINUTES = 30;

export const MIN_DURATION_MINUTES = 30;

export const MAX_DURATION_MINUTES = 240;

/**
 * Minutes since midnight for a "HH:mm" constant above.
 *
 * It lives here rather than beside each caller because the grid, the week
 * helpers and the booking rules all read the same two constants, and three
 * copies of the parsing is three places to change if the format ever does.
 */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
