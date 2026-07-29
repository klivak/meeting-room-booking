// Row heights of the schedule, in rem. They live in their own module because
// both the grid and its loading placeholder have to draw the same geometry, and
// values exported from a "use client" file reach a server component as client
// references rather than as numbers.
//
// 28px a row is what lets the whole week fit a 1366x768 laptop without the grid
// scrolling; a phone gets 48px, because there a row is a tap target.
export const ROW_REM = 1.75;
export const DAY_ROW_REM = 3;
export const HEADER_REM = 2.125;
