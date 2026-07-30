// First letters of the first two words: "Анна Ткаченко" → "АТ", "Ivan" → "I".
// Names in this product are free text, so anything else has to survive too.
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

/** The signed-in person, in the one place the header has room for them. */
export function Avatar({ name }: { name: string }) {
  return (
    <span
      // The name is already in the DOM next to it on wide screens and inside
      // the menu on narrow ones, so the circle itself is decoration.
      aria-hidden="true"
      className="bg-accent-own-booking text-accent-own-on flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
    >
      {initials(name)}
    </span>
  );
}
