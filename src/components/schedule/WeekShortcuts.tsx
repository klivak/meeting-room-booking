"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type WeekShortcutsProps = {
  previousHref: string;
  nextHref: string;
};

/**
 * Alt + left and right move between weeks, the way a calendar does.
 *
 * Alt rather than the bare arrows: inside the grid the plain arrow keys move the
 * focus from cell to cell, which is what makes a time range pickable without a
 * mouse. Typing into a field is left alone entirely.
 */
export function WeekShortcuts({ previousHref, nextHref }: WeekShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "");
      if (typing) {
        return;
      }

      // Alt + arrow is the browser's own back and forward, and here it has to
      // mean the previous and next week instead.
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        router.push(previousHref);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        router.push(nextHref);
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [router, previousHref, nextHref]);

  return null;
}
