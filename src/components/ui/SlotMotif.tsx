/**
 * Three half-hour slots — one booked between two free ones.
 *
 * The empty states and the 404 all need a picture, and the only vocabulary this
 * product has is its own grid: a block with a jade bar is a booking, a dashed
 * outline is a slot nobody has taken. Drawn in CSS rather than shipped as an
 * image so it follows the theme and costs nothing to load.
 */
export function SlotMotif({
  small = false,
  className,
}: {
  /** For a dropdown or a panel, where the full size would dominate. */
  small?: boolean;
  className?: string;
}) {
  // Sized rather than scaled: a transform thins the 1.5px dashed edge until it
  // disappears, and the dashed slot is half the point of the picture.
  const slot = small ? "h-8 w-6 gap-1" : "h-14 w-11";

  return (
    <span aria-hidden="true" className={`flex gap-1.5 ${className ?? ""}`}>
      <span
        className={`border-accent-own-past rounded-booking border-[1.5px] border-dashed ${slot}`}
      />
      <span
        className={`bg-accent-own-fill rounded-booking border-accent-own-booking border-l-[3px] ${slot}`}
      />
      <span
        className={`border-accent-own-past rounded-booking border-[1.5px] border-dashed ${slot}`}
      />
    </span>
  );
}
