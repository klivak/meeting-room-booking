/**
 * Three half-hour slots — one booked between two free ones.
 *
 * The empty states and the 404 all need a picture, and the only vocabulary this
 * product has is its own grid: a block with a jade bar is a booking, a dashed
 * outline is a slot nobody has taken. Drawn in CSS rather than shipped as an
 * image so it follows the theme and costs nothing to load.
 */
export function SlotMotif({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex gap-1.5 ${className ?? ""}`}>
      <span className="border-accent-own-past rounded-booking h-14 w-11 border-[1.5px] border-dashed" />
      <span className="bg-accent-own-fill rounded-booking border-accent-own-booking h-14 w-11 border-l-[3px]" />
      <span className="border-accent-own-past rounded-booking h-14 w-11 border-[1.5px] border-dashed" />
    </span>
  );
}
