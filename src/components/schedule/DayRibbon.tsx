/**
 * A day's occupancy as one 3px strip: one segment per half hour, filled where
 * something is booked and in the colour of whoever booked it.
 *
 * It answers "is this day worth opening?" without reading the column, which is
 * the question the week header is asked most often. Purely decorative — the
 * blocks below carry the same information in an accessible form.
 */
export function DayRibbon({
  /** Half-hour indexes, 0 = 09:00, taken by the viewer's own bookings. */
  mine,
  /** The same, for everyone else's. */
  others,
  slotCount,
  className,
}: {
  mine: ReadonlySet<number>;
  others: ReadonlySet<number>;
  slotCount: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`bg-surface-raised flex h-[3px] overflow-hidden rounded-full ${
        className ?? ""
      }`}
    >
      {Array.from({ length: slotCount }, (_, index) => (
        <span
          key={index}
          className={`flex-1 ${
            mine.has(index)
              ? "bg-accent-own-booking"
              : others.has(index)
                ? "bg-booking-other-author"
                : ""
          }`}
        />
      ))}
    </span>
  );
}
