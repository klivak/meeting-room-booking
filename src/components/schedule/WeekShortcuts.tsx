"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type WeekShortcutsProps = {
  previousHref: string;
  nextHref: string;
};

/**
 * Left and right arrows move between weeks, the way a calendar does.
 *
 * Typing into a field is left alone: a shortcut that eats the arrow keys inside
 * an input would make the booking form unusable.
 */
export function WeekShortcuts({ previousHref, nextHref }: WeekShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "");
      if (typing) {
        return;
      }

      if (event.key === "ArrowLeft") {
        router.push(previousHref);
      } else if (event.key === "ArrowRight") {
        router.push(nextHref);
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [router, previousHref, nextHref]);

  return null;
}
