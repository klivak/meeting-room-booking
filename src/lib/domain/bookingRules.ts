import { DateTime } from "luxon";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  OFFICE_TZ,
  SLOT_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
} from "./constants";

// Pure booking rules. No database, no framework: the API routes and the forms
// both call these, so a rule cannot be enforced in one place and forgotten in
// the other.

export type BookingRuleErrorCode =
  | "VALIDATION_ERROR"
  | "TITLE_INVALID"
  | "TIME_NOT_ALIGNED"
  | "DURATION_INVALID"
  | "OUTSIDE_WORKING_HOURS"
  | "TIME_IN_PAST";

export type BookingRuleError = {
  code: BookingRuleErrorCode;
  message: string;
};

export const MAX_TITLE_LENGTH = 100;

/** Minutes since midnight for a "HH:mm" constant. */
function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** A boundary must sit exactly on the 30-minute grid, with no stray seconds. */
function isAligned(moment: DateTime): boolean {
  return (
    moment.minute % SLOT_MINUTES === 0 &&
    moment.second === 0 &&
    moment.millisecond === 0
  );
}

/**
 * Validates the time part of a booking and returns every rule it breaks
 * (empty array means valid).
 *
 * Working hours are checked in office time regardless of where the user sits:
 * the same instant is 09:00 in Kyiv but 08:00 in Berlin, and the office is what
 * decides. Luxon does the conversion from the IANA zone, so the switch to
 * summer time is handled by the timezone database rather than a hardcoded offset.
 */
export function validateBookingTime(input: {
  startsAt: Date;
  endsAt: Date;
  now: Date;
}): BookingRuleError[] {
  const errors: BookingRuleError[] = [];

  const start = DateTime.fromJSDate(input.startsAt).setZone(OFFICE_TZ);
  const end = DateTime.fromJSDate(input.endsAt).setZone(OFFICE_TZ);

  // Everything below assumes a forward interval, so this one stops the check.
  if (input.startsAt >= input.endsAt) {
    return [
      {
        code: "VALIDATION_ERROR",
        message: "Час завершення має бути пізнішим за час початку",
      },
    ];
  }

  if (!isAligned(start) || !isAligned(end)) {
    errors.push({
      code: "TIME_NOT_ALIGNED",
      message: `Час має бути кратним ${SLOT_MINUTES} хвилинам`,
    });
  }

  const durationMinutes = end.diff(start, "minutes").minutes;
  if (
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    errors.push({
      code: "DURATION_INVALID",
      message: `Тривалість бронювання — від ${MIN_DURATION_MINUTES} хвилин до ${
        MAX_DURATION_MINUTES / 60
      } годин`,
    });
  }

  // A booking may end exactly at 19:00, and it may not span two office days.
  const startsBeforeOpening = start.hour * 60 + start.minute < minutesOfDay(WORK_DAY_START);
  const endsAfterClosing = end.hour * 60 + end.minute > minutesOfDay(WORK_DAY_END);
  const spansTwoDays = start.toISODate() !== end.toISODate();

  if (startsBeforeOpening || endsAfterClosing || spansTwoDays) {
    errors.push({
      code: "OUTSIDE_WORKING_HOURS",
      message: `Бронювати можна лише з ${WORK_DAY_START} до ${WORK_DAY_END} за київським часом`,
    });
  }

  // "Future only" means strictly later: a booking starting exactly now is late.
  if (input.startsAt <= input.now) {
    errors.push({
      code: "TIME_IN_PAST",
      message: "Час бронювання вже минув",
    });
  }

  return errors;
}

export type BookingAccess = "allowed" | "not-owner" | "canceled" | "finished";

/**
 * Decides whether a booking may still be edited or canceled.
 *
 * Ownership is checked first so a stranger never learns whether someone else's
 * booking is canceled. A booking stays modifiable until it ends, even if it has
 * already started, and a canceled one counts as gone.
 */
export function checkBookingAccess(
  booking: { userId: string; canceledAt: Date | null; endsAt: Date },
  userId: string,
  now: Date,
): BookingAccess {
  if (booking.userId !== userId) {
    return "not-owner";
  }

  if (booking.canceledAt !== null) {
    return "canceled";
  }

  if (booking.endsAt <= now) {
    return "finished";
  }

  return "allowed";
}

/** Title must be 1..100 characters once surrounding spaces are dropped. */
export function validateTitle(title: string): BookingRuleError | null {
  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return { code: "TITLE_INVALID", message: "Вкажіть назву бронювання" };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return {
      code: "TITLE_INVALID",
      message: `Назва не може бути довшою за ${MAX_TITLE_LENGTH} символів`,
    };
  }

  return null;
}
