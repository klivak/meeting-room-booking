import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

/**
 * Language switcher. Plain forms with a server action, so it works without
 * client-side JavaScript and needs no state of its own. The two halves sit in
 * one bordered group, which is what makes it read as a switch rather than as
 * two unrelated buttons.
 */
export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("app");

  return (
    <div
      aria-label={t("language")}
      className="border-border-grid bg-surface-muted rounded-chip flex h-11 items-center gap-0.5 border p-[3px] sm:h-9"
    >
      {LOCALES.map((locale) => (
        <form
          key={locale}
          action={async () => {
            "use server";
            await setLocale(locale);
            // Everything is rendered per language, so the whole tree is stale.
            revalidatePath("/", "layout");
          }}
          className="flex h-full"
        >
          <button
            type="submit"
            aria-current={locale === current ? "true" : undefined}
            title={LOCALE_LABELS[locale]}
            className={`focus-ring-tight flex h-full items-center rounded-[6px] px-2.5 font-mono text-xs transition ${
              locale === current
                ? "bg-accent-own-booking text-accent-own-on font-bold"
                : "text-text-secondary hover:text-text-primary font-semibold"
            }`}
          >
            {LOCALE_SHORT_LABELS[locale]}
          </button>
        </form>
      ))}
    </div>
  );
}
