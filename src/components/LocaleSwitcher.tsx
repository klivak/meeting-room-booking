import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

/**
 * Language switcher. Plain forms with a server action, so it works without
 * client-side JavaScript and needs no state of its own.
 */
export async function LocaleSwitcher() {
  const current = await getLocale();
  const t = await getTranslations("app");

  return (
    <div className="flex items-center gap-1" aria-label={t("language")}>
      {LOCALES.map((locale) => (
        <form
          key={locale}
          action={async () => {
            "use server";
            await setLocale(locale);
            // Everything is rendered per language, so the whole tree is stale.
            revalidatePath("/", "layout");
          }}
        >
          <button
            type="submit"
            aria-current={locale === current ? "true" : undefined}
            title={LOCALE_LABELS[locale]}
            className={`rounded px-1.5 py-1 text-xs font-medium uppercase transition focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none ${
              locale === current
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {locale}
          </button>
        </form>
      ))}
    </div>
  );
}
