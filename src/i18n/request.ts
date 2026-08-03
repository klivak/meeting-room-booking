import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, isLocale, preferredLocale } from "./config";

/**
 * Resolves the language for a request: an explicit choice wins, then what the
 * browser asks for, then the office default.
 */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;

  if (isLocale(chosen)) {
    return { locale: chosen, messages: await load(chosen) };
  }

  const locale = preferredLocale((await headers()).get("accept-language") ?? "");

  return { locale, messages: await load(locale) };
});

async function load(locale: string) {
  return (await import(`../../messages/${locale}.json`)).default;
}
