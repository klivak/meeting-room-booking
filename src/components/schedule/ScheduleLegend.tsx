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
        <span className="border-accent-own-booking bg-accent-own-surface rounded-booking h-3.5 w-5.5 border shadow-[inset_3px_0_0_var(--color-accent-own-booking)]" />
        {t("mine")}
      </span>
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-border-control bg-surface-muted hatch rounded-booking h-3.5 w-5.5 border" />
        {t("others")}
      </span>
      <span className="text-text-secondary flex items-center gap-1.5 text-xs">
        <span className="border-accent-own-past text-accent-own-past rounded-booking flex h-3.5 w-5.5 items-center justify-center border border-dashed text-[9px]">
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
