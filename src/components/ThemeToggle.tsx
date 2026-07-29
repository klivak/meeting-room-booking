"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  THEMES,
  readSystemTheme,
  readTheme,
  setTheme,
  subscribeToTheme,
  type Theme,
} from "@/components/theme";

// Symbols rather than an icon set: the application already speaks in ← → ✕ ↻,
// and one more dependency for three glyphs is not worth its weight.
const SYMBOLS: Record<Theme, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/**
 * Cycles system → light → dark. The server cannot know the stored preference,
 * so it renders the neutral "system" face and the browser corrects it after
 * hydration — the same trick the timezone-dependent parts use.
 */
export function ThemeToggle() {
  const t = useTranslations("app");
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, readSystemTheme);

  return (
    <button
      type="button"
      onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
      // The label names the current mode, not the next one: a screen reader user
      // needs to know where they are before deciding to press.
      aria-label={t(`theme.${theme}`)}
      title={t(`theme.${theme}`)}
      className="focus-ring border-border-grid text-text-secondary hover:border-border-control hover:text-text-primary rounded-control flex h-11 w-11 items-center justify-center border transition sm:h-9 sm:w-9"
    >
      <span aria-hidden="true" className="text-[15px] leading-none">
        {SYMBOLS[theme]}
      </span>
    </button>
  );
}
