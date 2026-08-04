import { getTranslations } from "next-intl/server";

/**
 * The key under the week grid. It needs no data, so the loading placeholder
 * renders the real thing rather than an imitation of it — which is the only way
 * its height is guaranteed to be the same before and after the week arrives.
 *
 * Four swatches, four textures: the point of the grid is that ownership stays
 * readable without colour, and the key has to prove it.
 */
export async function ScheduleLegend() {
  const t = await getTranslations("schedule");

  return (
    <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 px-1 sm:flex">
      <span className="text-text-secondary flex items-center gap-[7px] text-xs font-semibold">
        <span className="border-accent-own-booking bg-accent-own-fill h-3 w-[22px] rounded-[3px] border-l-[3px]" />
        {t("mine")}
      </span>
      <span className="text-text-secondary flex items-center gap-[7px] text-xs font-semibold">
        <span className="border-booking-other-author hatch h-3 w-[22px] rounded-[3px] border-l-[3px]" />
        {t("others")}
      </span>
      <span className="text-text-secondary flex items-center gap-[7px] text-xs font-semibold">
        <span className="border-accent-own-past h-3 w-[22px] rounded-[3px] border-[1.5px] border-dashed" />
        {t("mineFinished")}
      </span>
      <span className="text-text-secondary flex items-center gap-[7px] text-xs font-semibold">
        <span className="bg-now-line h-0.5 w-[22px]" />
        {t("now")}
      </span>
      <span className="text-text-tertiary ml-auto hidden text-xs lg:inline">
        {t("hint")}
      </span>
    </div>
  );
}
