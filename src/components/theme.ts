// The theme choice, kept outside React because the browser already owns it: an
// inline script in the document head applies it before the first paint, so the
// page never flashes white on the way to the dark theme. The switch in the
// header reads and writes the same key.

export const THEME_STORAGE_KEY = "theme";

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

const DARK_QUERY = "(prefers-color-scheme: dark)";

let current: Theme | null = null;
const listeners = new Set<() => void>();

/** Puts a choice on the document, resolving "system" against the OS setting. */
function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia(DARK_QUERY).matches);

  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function readTheme(): Theme {
  if (current === null) {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    current = stored === "light" || stored === "dark" ? stored : "system";
  }

  return current;
}

/** What the server renders: it cannot know the preference, so it assumes none. */
export const readSystemTheme = (): Theme => "system";

export function setTheme(next: Theme) {
  current = next;
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  apply(next);

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Following the system means reacting to it while the page is open, so the OS
 * switching to dark at sunset is picked up without a reload.
 */
export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);

  const query = window.matchMedia(DARK_QUERY);
  const sync = () => {
    if (readTheme() === "system") {
      apply("system");
    }
  };
  query.addEventListener("change", sync);

  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", sync);
  };
}
