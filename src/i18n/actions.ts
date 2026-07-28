"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, type Locale } from "./config";

const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

/**
 * Remembers the chosen language. A server action rather than an endpoint: the
 * switcher is a form, so it keeps working before any JavaScript loads.
 */
export async function setLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: YEAR_IN_SECONDS,
    sameSite: "lax",
  });
}
