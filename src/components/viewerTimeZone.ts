import { OFFICE_TZ } from "@/lib/domain/constants";

// The viewer's timezone exists only in the browser, so the server render — and
// with it the first client render — falls back to office time and swaps after
// hydration. Passed to useSyncExternalStore by every component that shows times.

export const noopSubscribe = () => () => {};
export const readViewerTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;
export const readOfficeTimeZone = () => OFFICE_TZ;
