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
