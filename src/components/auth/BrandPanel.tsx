import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LogoMark } from "@/components/ui/LogoMark";
import {
  OFFICE_TZ,
  WORK_DAY_END,
  WORK_DAY_START,
} from "@/lib/domain/constants";

const POINTS = ["pitchGrid", "pitchOwn", "pitchZone"] as const;

/**
 * A week card floating off the edge of the brand panel.
 *
 * Purely decorative, and deliberately built from the same parts as the real
 * grid — a jade block, a hatched one, a dashed free slot, the warm "now" line —
 * so the first screen already teaches the vocabulary of the second. A
 * screenshot would go stale the first time the grid changes; this cannot.
 */
function WeekPreview() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[150px] -right-[70px] w-[420px] -rotate-3 overflow-hidden rounded-[18px] border border-white/25 bg-white/10 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.55)] backdrop-blur-md"
    >
      <div className="grid grid-cols-[40px_repeat(5,1fr)] border-b border-white/15 bg-white/8">
        <span />
        {["Пн", "Вт", "Ср", "Чт", "Пт"].map((day, index) => (
          <span
            key={day}
            className={`py-2 text-center font-mono text-[11px] font-bold ${
              index === 1 ? "bg-white/12 text-white" : "text-white/85"
            }`}
          >
            {day}
          </span>
        ))}
      </div>

      <div className="relative grid h-[300px] grid-cols-[40px_repeat(5,1fr)] [background-image:repeating-linear-gradient(to_bottom,transparent_0_43px,rgb(255_255_255/0.08)_43px_44px)]">
        <span className="flex flex-col justify-between border-r border-white/12 px-1.5 pt-1 font-mono text-[9px] text-white/55">
          <span>10:00</span>
          <span>13:00</span>
          <span>16:00</span>
          <span />
        </span>

        <span className="relative border-r border-white/8">
          <span className="absolute inset-x-1 top-12 h-[62px] rounded-[7px] border-l-[3px] border-white bg-white/16" />
        </span>
        <span className="relative border-r border-white/8 bg-white/5">
          <span className="absolute inset-x-1 top-[110px] h-[46px] rounded-[7px] border-l-[3px] border-[#F0A752] [background-image:repeating-linear-gradient(45deg,rgb(255_255_255/0.22)_0_6px,rgb(255_255_255/0.06)_6px_12px)]" />
        </span>
        <span className="relative border-r border-white/8" />
        <span className="relative border-r border-white/8">
          <span className="absolute inset-x-1 top-[168px] h-10 rounded-[7px] border-[1.5px] border-dashed border-white/55" />
        </span>
        <span className="relative">
          <span className="absolute inset-x-1 top-[92px] h-[54px] rounded-[7px] border-l-[3px] border-white bg-white/16" />
        </span>

        <span className="absolute top-[132px] right-0 left-10 h-0.5 bg-[#F0A752] shadow-[0_0_12px_rgb(240_167_82/0.8)]" />
      </div>
    </div>
  );
}

/**
 * The half of the sign-in screen that says what this is.
 *
 * Hidden below lg: on a phone there is nothing to do here but sign in, and a
 * tall brand panel above the form would push it under the fold.
 */
export async function BrandPanel() {
  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");

  return (
    <aside className="relative hidden flex-col overflow-hidden bg-[linear-gradient(160deg,#0E8A66_0%,#12211C_130%)] p-14 lg:flex">
      {/* Light from the top right plus the ruling of a schedule: enough texture
          that the panel is not a flat rectangle, faint enough to stay behind
          the words. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-40 [background-image:radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/0.10),transparent_55%),repeating-linear-gradient(to_bottom,rgb(255_255_255/0.05)_0_1px,transparent_1px_44px)]"
      />

      <WeekPreview />

      <div className="relative flex items-center gap-3">
        <LogoMark className="size-9 rounded-[10px] bg-white/16 bg-none p-[9px]" />
        <span className="text-[17px] font-extrabold text-white">
          {tApp("title")}
        </span>
      </div>

      <div className="relative mt-auto flex flex-col gap-[22px]">
        <h2 className="max-w-[460px] text-[40px] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance text-white">
          {t("pitchTitle")}
        </h2>

        <ul className="flex flex-col gap-3">
          {POINTS.map((key) => (
            <li key={key} className="flex items-center gap-[11px]">
              <span className="flex size-5 flex-none items-center justify-center rounded-md bg-white/16">
                <Check
                  aria-hidden="true"
                  className="size-[13px] text-white"
                  strokeWidth={3}
                />
              </span>
              <span className="text-[14.5px] font-medium text-white/90">
                {t(key)}
              </span>
            </li>
          ))}
        </ul>

        {/* The office zone is a rule of the domain, not a detail of the schedule
            screen, so it is said before the first booking rather than after. */}
        <p className="mt-1.5 font-mono text-xs text-white/60">
          {t("pitchHours", {
            from: WORK_DAY_START,
            to: WORK_DAY_END,
            zone: OFFICE_TZ,
          })}
        </p>
      </div>
    </aside>
  );
}
