/**
 * The brand mark: four squares on a jade tile, two of them brighter.
 *
 * It is the smallest thing this product is about — a grid of slots, some taken
 * and some free — rather than a calendar glyph borrowed from an icon set. Drawn
 * with CSS grid so it stays sharp at any size and needs no asset.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-gradient grid size-8 shrink-0 grid-cols-2 grid-rows-2 gap-[2.5px] rounded-[9px] p-2 ${
        className ?? ""
      }`}
    >
      <span className="rounded-[1.5px] bg-white/95" />
      <span className="rounded-[1.5px] bg-white/55" />
      <span className="rounded-[1.5px] bg-white/55" />
      <span className="rounded-[1.5px] bg-white/95" />
    </span>
  );
}
