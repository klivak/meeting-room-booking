"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { IconButton } from "@/components/ui/IconButton";
import {
  THEMES,
  readSystemTheme,
  readTheme,
  setTheme,
  subscribeToTheme,
  type Theme,
} from "@/components/theme";

const ICONS: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Cycles system → light → dark. The server cannot know the stored preference,
 * so it renders the neutral "system" face and the browser corrects it after
 * hydration — the same trick the timezone-dependent parts use.
 */
export function ThemeToggle() {
  const t = useTranslations("app");
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, readSystemTheme);
  const Icon = ICONS[theme];

  return (
    <IconButton
      onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
      // The label names the current mode, not the next one: a screen reader user
      // needs to know where they are before deciding to press.
      label={t(`theme.${theme}`)}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </IconButton>
  );
}
