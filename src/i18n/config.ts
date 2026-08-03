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

// Two letters for the switch in the header. Ukrainian is "UA" rather than the
// ISO "UK", because in a header next to "EN" that reads as United Kingdom.
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  uk: "UA",
  en: "EN",
};

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes((value ?? "") as Locale);
}

/**
 * The language an Accept-Language header asks for, or the office default.
 *
 * The header is split into tags and compared by the primary subtag, in the
 * order the browser listed them. Searching the whole header for a substring
 * would answer "uk" to "en-UK" and would let the order of LOCALES outrank the
 * order the browser actually asked for.
 */
export function preferredLocale(header: string): Locale {
  const tags = header
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .map((tag) => tag.split("-")[0]);

  return tags.find((tag): tag is Locale => isLocale(tag)) ?? DEFAULT_LOCALE;
}
