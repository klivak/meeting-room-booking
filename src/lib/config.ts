// Public configuration: safe to import from both server and client code.
// Server-only variables live in src/lib/server/env.ts.

// NEXT_PUBLIC_* variables are inlined by Next at build time, so this one must be
// referenced literally rather than looked up dynamically.
const rawWeekStartDay = Number(process.env.NEXT_PUBLIC_WEEK_START_DAY ?? 1);

/** First day of the week in the schedule grid: 1 = Monday ... 7 = Sunday. */
export const WEEK_START_DAY =
  Number.isInteger(rawWeekStartDay) && rawWeekStartDay >= 1 && rawWeekStartDay <= 7
    ? rawWeekStartDay
    : 1;
