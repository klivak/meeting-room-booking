// Language is kept in a cookie rather than in the address, so every existing
// link keeps working and the schedule URLs stay about the schedule. The default
// is Ukrainian because that is the office this is built for.

export const LOCALES = ["uk", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uk";

export const LOCALE_COOKIE = "locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  uk: "Українська",
  en: "English",
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes((value ?? "") as Locale);
}
