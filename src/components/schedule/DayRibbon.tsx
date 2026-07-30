/**
 * A day's occupancy as one 3px strip: twenty segments, one per half hour,
 * filled where something is booked. It answers "is this day worth opening?"
 * without reading the column, which is the question the week header is asked
 * most often. Purely decorative — the blocks below carry the same information
 * in an accessible form.
 */
export function DayRibbon({
  /** Half-hour indexes, 0 = 09:00, that are taken. */
  busy,
  slotCount,
  className,
}: {
  busy: ReadonlySet<number>;
  slotCount: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`bg-surface-raised flex h-[3px] overflow-hidden rounded-full ${className ?? ""}`}
    >
      {Array.from({ length: slotCount }, (_, index) => (
        <span
          key={index}
          className={`flex-1 ${busy.has(index) ? "bg-accent-own-booking" : ""}`}
        />
      ))}
    </span>
  );
}
