// Row heights of the schedule. They live in their own module because both the
// grid and its loading placeholder have to draw the same geometry, and values
// exported from a "use client" file reach a server component as client
// references rather than as numbers.
//
// They are CSS lengths rather than plain numbers because the week row grows on a
// large screen and only CSS knows how large the screen is (see --spacing-slot in
// globals.css). Everything the grid positions is a calc() over one of them.
export const ROW_H = "var(--spacing-slot)";
export const DAY_ROW_H = "var(--spacing-slot-touch)";
// Unchanged by the occupancy strip on purpose: the strip is drawn against the
// bottom edge of the header rather than stacked under the label, because the
// whole week has to keep fitting a 1366x768 laptop without the page scrolling.
export const HEADER_REM = 2.125;

/** Height of a whole number of grid rows, as a CSS length. */
export function rowSpan(count: number, rowHeight: string): string {
  return `calc(${count} * ${rowHeight})`;
}
