"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ScheduleShortcutsProps = {
  previousHref: string;
  nextHref: string;
  todayHref: string;
};

// Every shortcut the schedule answers, in the order the help lists them. The
// keys are printed as they are typed; the descriptions come from the messages.
const SHORTCUTS = [
  { keys: ["Alt", "←"], hint: "week" },
  { keys: ["Alt", "→"], hint: "weekNext" },
  { keys: ["T"], hint: "today" },
  { keys: ["↑", "↓", "←", "→"], hint: "cells" },
  { keys: ["Enter"], hint: "book" },
  { keys: ["Alt", "↑↓←→"], hint: "moveBooking" },
  { keys: ["Shift", "↑↓"], hint: "resizeBooking" },
  { keys: ["Esc"], hint: "close" },
  { keys: ["?"], hint: "help" },
];

/**
 * The shortcuts that belong to the whole schedule rather than to one element,
 * and the sheet that says they exist — a shortcut nobody can discover is a
 * shortcut nobody uses.
 *
 * Alt rather than the bare arrows for the weeks: inside the grid the plain arrow
 * keys move the focus from cell to cell, which is what makes a time range
 * pickable without a mouse. Typing into a field is left alone entirely.
 */
export function ScheduleShortcuts({
  previousHref,
  nextHref,
  todayHref,
}: ScheduleShortcutsProps) {
  const router = useRouter();
  const t = useTranslations("shortcuts");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "");
      if (typing) {
        return;
      }

      if (event.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        return;
      }

      // Shift is part of typing "?" on most layouts, so it is not treated as a
      // modifier here the way Alt is below.
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      // Case-insensitive and in both layouts: caps lock, a held shift and a
      // Ukrainian keyboard all still mean "take me to this week".
      const letter = event.key.toLowerCase();
      if ((letter === "t" || letter === "т") && !event.altKey) {
        event.preventDefault();
        router.push(todayHref);
        return;
      }

      // A focused booking of the viewer's own takes Alt + arrow for itself: the
      // same combination moves it a day earlier or later.
      if (!event.altKey || event.shiftKey || target?.closest("[data-reshapable]")) {
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
  }, [router, previousHref, nextHref, todayHref, helpOpen]);

  // The trigger sits beside the week navigation rather than under the grid: the
  // legend line there is already as long as 1366px allows, and one more item
  // wraps it onto a second row — which costs the week its last half hour.
  const trigger = (
    <button
      type="button"
      onClick={() => setHelpOpen(true)}
      aria-label={t("title")}
      title={t("title")}
      className="focus-ring border-border-grid bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary rounded-control hidden h-8 w-8 items-center justify-center border font-mono text-sm font-semibold transition sm:flex"
    >
      <span aria-hidden="true">?</span>
    </button>
  );

  if (!helpOpen) {
    return trigger;
  }

  return (
    <>
      {trigger}
      <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-[oklch(0.24_0.02_264/0.45)] p-6"
      onClick={(event) => {
        if (event.currentTarget === event.target) {
          setHelpOpen(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="rounded-panel bg-surface border-border-control shadow-modal animate-rise flex w-full max-w-[420px] flex-col gap-3 border px-5 py-4.5"
      >
        <h2
          id="shortcuts-title"
          className="text-[17px] font-semibold tracking-tight"
        >
          {t("title")}
        </h2>

        <ul className="flex flex-col">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.hint}
              className="border-border-grid-half flex items-center gap-3 border-b py-2 last:border-b-0"
            >
              <span className="flex flex-none gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="border-border-control bg-surface-muted text-text-primary rounded flex min-w-6 items-center justify-center border px-1.5 py-0.5 font-mono text-xs font-semibold"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-text-secondary text-[13px] leading-snug">
                {t(shortcut.hint)}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          autoFocus
          onClick={() => setHelpOpen(false)}
          className="focus-ring border-border-control text-text-primary hover:bg-surface-muted rounded-control mt-1 min-h-11 self-end border px-3.5 text-sm font-medium transition sm:min-h-[38px]"
        >
          {t("close")}
        </button>
      </div>
      </div>
    </>
  );
}
