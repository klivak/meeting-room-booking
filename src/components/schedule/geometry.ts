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

// A sliver of the half hour before the office opens, drawn above the first row.
// Without it 09:00 starts hard against the header: the label has nowhere to sit
// but inside its own row, and a booking at 09:00 touches the edge of the card
// instead of standing on a line. It is deliberately not a bookable row — there
// is nothing to book there — so it is a strip, not a cell.
export const TOP_GUTTER = "calc(var(--spacing-slot) * 0.4)";
export const TOP_GUTTER_TOUCH = "calc(var(--spacing-slot-touch) * 0.3)";

/** Height of a whole number of grid rows, as a CSS length. */
export function rowSpan(count: number, rowHeight: string): string {
  return `calc(${count} * ${rowHeight})`;
}
