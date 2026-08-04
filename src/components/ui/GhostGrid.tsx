/**
 * The schedule, abstracted to a ruling and two blocks that fell off it.
 *
 * The backdrop for the pages that have nothing of their own to show — 404 and
 * the room that no longer exists. It uses the vocabulary of the grid rather
 * than a stock illustration, so it cannot go stale and needs no asset.
 */
export function GhostGrid() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute inset-0 opacity-50 [background-image:repeating-linear-gradient(to_right,var(--color-border-grid)_0_1px,transparent_1px_68px),repeating-linear-gradient(to_bottom,var(--color-border-grid)_0_1px,transparent_1px_40px)]" />
      <span className="bg-accent-own-fill border-accent-own-booking rounded-booking absolute top-[90px] left-[90px] h-[62px] w-[130px] -rotate-4 border-l-[3px]" />
      <span className="hatch border-booking-other-author rounded-booking absolute right-[100px] bottom-20 h-[62px] w-[130px] rotate-5 border-l-[3px]" />
    </span>
  );
}
