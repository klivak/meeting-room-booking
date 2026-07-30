import { getTranslations } from "next-intl/server";

/**
 * The key under the week grid. It needs no data, so the loading placeholder
 * renders the real thing rather than an imitation of it — which is the only way
 * its height is guaranteed to be the same before and after the week arrives.
 */
export async function ScheduleLegend() {
  const t = await getTranslations("schedule");

  return (
    <div className="hidden flex-wrap items-center gap-4 sm:flex">
      <span className="text-text-tertiary text-[13px]">{t("hint")}</span>
      <span className="bg-border-grid h-4 w-px" />
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-accent-own-booking bg-accent-own-surface h-3.5 w-5.5 rounded-[3px] border shadow-[inset_3px_0_0_var(--color-accent-own-booking),var(--shadow-rest)]" />
        {t("mine")}
      </span>
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-border-grid hatch h-3.5 w-5.5 rounded-[3px] border shadow-[inset_3px_0_0_var(--color-booking-other-author)]" />
        {t("others")}
      </span>
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-accent-own-past text-accent-own-past flex h-3.5 w-5.5 rounded-[3px] items-center justify-center border border-dashed text-[9px]">
          ✓
        </span>
        {t("mineFinished")}
      </span>
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-now-line w-5.5 border-t-2" />
        {t("now")}
      </span>
    </div>
  );
}
