import { DateTime } from "luxon";

import { SLOT_MINUTES, WORK_DAY_END, WORK_DAY_START } from "./constants";

// Helpers for the weekly grid. Pure: they take a DateTime that already carries
// its zone and never look at the current moment or the system timezone.

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Start of the week (midnight of its first day) that contains `date`, in the
 * zone `date` is already in.
 *
 * The first day is configurable, so the modulo answers "how many days back is
 * the most recent occurrence of that weekday": with weekStartDay = 1 (Monday)
 * a Sunday goes back six days, not forward one.
 */
export function getWeekStart(date: DateTime, weekStartDay: number): DateTime {
  const daysSinceWeekStart = (date.weekday - weekStartDay + 7) % 7;

  // startOf("day") before subtracting keeps the result at local midnight even
  // when a DST switch falls inside the week.
  return date.startOf("day").minus({ days: daysSinceWeekStart });
}

/**
 * Row labels for the grid: every slot start of the office day, so 09:00 up to
 * 18:30. The closing time itself is not a slot, it is only an end boundary.
 */
export function generateSlots(): string[] {
  const slots: string[] = [];
  const end = minutesOfDay(WORK_DAY_END);

  for (
    let minutes = minutesOfDay(WORK_DAY_START);
    minutes < end;
    minutes += SLOT_MINUTES
  ) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const rest = String(minutes % 60).padStart(2, "0");
    slots.push(`${hours}:${rest}`);
  }

  return slots;
}
