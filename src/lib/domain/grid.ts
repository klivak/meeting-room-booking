import { DateTime } from "luxon";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  OFFICE_TZ,
  SLOT_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
  minutesOfDay,
} from "./constants";

// Geometry of the weekly grid.
//
// Rows are anchored to office time: row i is always "09:00 in Kyiv plus i * 30
// minutes". The axis labels are that same instant rendered in the viewer's
// timezone, which is how a user in Berlin sees the office day as 08:00-18:00.
//
// Anchoring to the office instead of to the viewer's local minutes keeps the
// grid rectangular in every timezone: for a viewer in Tokyo the office day runs
// past local midnight, and "minutes since midnight" would break there.

const OPEN_MINUTES = minutesOfDay(WORK_DAY_START);
const CLOSE_MINUTES = minutesOfDay(WORK_DAY_END);

/** Length of the office day in minutes. */
export const WINDOW_MINUTES = CLOSE_MINUTES - OPEN_MINUTES;

/** Number of 30-minute rows in the grid. */
export const SLOT_COUNT = WINDOW_MINUTES / SLOT_MINUTES;

export const DAYS_IN_WEEK = 7;

export type GridPlacement = {
  /** Column, 0 = first day of the displayed week. */
  dayIndex: number;
  /** First row the booking occupies, 0-based. */
  rowStart: number;
  /** How many rows it spans. */
  rowSpan: number;
};

/** The seven office days of the displayed week, each at office-time midnight. */
export function getWeekDays(weekStart: DateTime): DateTime[] {
  const start = weekStart.setZone(OFFICE_TZ).startOf("day");

  return Array.from({ length: DAYS_IN_WEEK }, (_, index) =>
    start.plus({ days: index }),
  );
}

/**
 * Where a booking sits in the grid, or null when it falls outside the displayed
 * week. The day is decided by the calendar date in office time, so a booking
 * belongs to the office day it was made for regardless of where the viewer is.
 */
export function placeBooking(
  booking: { startsAt: Date; endsAt: Date },
  weekStart: DateTime,
): GridPlacement | null {
  const start = DateTime.fromJSDate(booking.startsAt).setZone(OFFICE_TZ);
  const end = DateTime.fromJSDate(booking.endsAt).setZone(OFFICE_TZ);

  const dayIndex = getWeekDays(weekStart).findIndex(
    (day) => day.toISODate() === start.toISODate(),
  );
  if (dayIndex === -1) {
    return null;
  }

  const startMinutes = start.hour * 60 + start.minute - OPEN_MINUTES;
  const endMinutes = end.hour * 60 + end.minute - OPEN_MINUTES;

  const rowStart = Math.round(startMinutes / SLOT_MINUTES);
  const rowEnd = Math.round(endMinutes / SLOT_MINUTES);

  // Clamping is a safety net for rows that predate a rule change; validation
  // keeps new bookings inside the window.
  const clampedStart = Math.max(0, Math.min(rowStart, SLOT_COUNT - 1));
  const clampedEnd = Math.max(clampedStart + 1, Math.min(rowEnd, SLOT_COUNT));

  return {
    dayIndex,
    rowStart: clampedStart,
    rowSpan: clampedEnd - clampedStart,
  };
}

/**
 * The instant a grid cell stands for: the office day plus the row offset.
 * Used to turn a click on an empty cell into a concrete booking start.
 */
export function getSlotStart(day: DateTime, rowIndex: number): DateTime {
  return day
    .setZone(OFFICE_TZ)
    .startOf("day")
    .plus({ minutes: OPEN_MINUTES + rowIndex * SLOT_MINUTES });
}

/**
 * Time axis labels for one day of the week, rendered in the viewer's timezone.
 *
 * They are computed per day rather than once for the week because a DST switch
 * that applies to only one of the two zones shifts the labels mid-week.
 */
export function getSlotLabels(day: DateTime, timeZone: string): string[] {
  const dayStart = day
    .setZone(OFFICE_TZ)
    .startOf("day")
    .plus({ minutes: OPEN_MINUTES });

  return Array.from({ length: SLOT_COUNT }, (_, index) =>
    dayStart
      .plus({ minutes: index * SLOT_MINUTES })
      .setZone(timeZone)
      .toFormat("HH:mm"),
  );
}

/**
 * Slot index of an instant inside the office day: the inverse of getSlotStart,
 * used to prefill the form from a booking or from a clicked cell.
 */
export function getSlotIndex(instant: Date): number {
  const moment = DateTime.fromJSDate(instant).setZone(OFFICE_TZ);

  return Math.round(
    (moment.hour * 60 + moment.minute - OPEN_MINUTES) / SLOT_MINUTES,
  );
}

/**
 * Label for one slot boundary, rendered in the viewer's timezone.
 *
 * Index 0 is opening time and index SLOT_COUNT is closing time, which is a
 * valid end but never a valid start.
 */
export function getSlotLabel(
  day: DateTime,
  index: number,
  timeZone: string,
): string {
  return getSlotStart(day, index).setZone(timeZone).toFormat("HH:mm");
}

/**
 * Which end slots are offered for a given start: at least the minimum duration,
 * at most the maximum, and never past closing time. Encoding the duration rule
 * in the options means an invalid pair cannot be built in the form at all.
 */
export function getEndSlotBounds(startIndex: number): {
  min: number;
  max: number;
} {
  const min = startIndex + MIN_DURATION_MINUTES / SLOT_MINUTES;
  const max = Math.min(
    startIndex + MAX_DURATION_MINUTES / SLOT_MINUTES,
    SLOT_COUNT,
  );

  return { min, max };
}

/**
 * Rows covered by dragging from one cell to another, as a half-open range.
 *
 * The drag may go upwards, so the anchor is not necessarily the start, and it
 * is clamped to the allowed duration: the grid should not offer a selection the
 * server would refuse.
 */
export function getSelectionRows(
  anchorRow: number,
  focusRow: number,
): { rowStart: number; rowEnd: number } {
  const rowStart = Math.min(anchorRow, focusRow);
  const maxRows = MAX_DURATION_MINUTES / SLOT_MINUTES;
  const rowEnd = Math.min(
    Math.max(anchorRow, focusRow) + 1,
    rowStart + maxRows,
    SLOT_COUNT,
  );

  return { rowStart, rowEnd };
}

/**
 * Splits a duration into hours and minutes. Deliberately no words: how a
 * duration is said differs per language, so that belongs to the dictionary.
 */
export function splitDuration(minutes: number): {
  hours: number;
  minutes: number;
} {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/**
 * Position of the "now" line: which day column it belongs to and how far down
 * the office day it sits, as a 0..1 fraction. Null outside the displayed week
 * or outside working hours.
 */
export function getNowMarker(
  now: Date,
  weekStart: DateTime,
): { dayIndex: number; ratio: number } | null {
  const moment = DateTime.fromJSDate(now).setZone(OFFICE_TZ);

  const dayIndex = getWeekDays(weekStart).findIndex(
    (day) => day.toISODate() === moment.toISODate(),
  );
  if (dayIndex === -1) {
    return null;
  }

  const minutes = moment.hour * 60 + moment.minute - OPEN_MINUTES;
  if (minutes < 0 || minutes > WINDOW_MINUTES) {
    return null;
  }

  return { dayIndex, ratio: minutes / WINDOW_MINUTES };
}
