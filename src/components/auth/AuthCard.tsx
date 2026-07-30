import { CalendarDays, Clock, User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { OFFICE_TZ } from "@/lib/domain/constants";

// One icon per promise, in the order the promises are made.
const POINTS = [
  { key: "pitchGrid", Icon: CalendarDays },
  { key: "pitchOwn", Icon: User },
  { key: "pitchZone", Icon: Clock },
] as const;

// The frame shared by sign-in and registration. One narrow column on a small
// screen, because there is nothing else to do here; from lg up it becomes a
// split screen, since a 1920px screen with a 376px card floating in the middle
// of it reads as a page that failed to load.
export async function AuthCard({
  title,
  subtitle,
  footerText,
  footerLinkHref,
  footerLinkText,
  children,
}: {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkText: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");

  return (
    // dvh rather than a percentage: body only carries a min-height, so a
    // percentage one here resolves to auto and the accent panel stops halfway
    // down the screen.
    <div className="flex min-h-dvh w-full lg:grid lg:grid-cols-2">
      {/* Text on a flat accent field, no illustration: it has to survive
          translation and both themes, and a screenshot of the grid would go
          stale the first time the grid changes. The faint ruling behind it is
          the schedule itself, abstracted to the only two lines it is made of. */}
      <aside className="bg-accent-own-booking text-accent-own-on relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <span
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.14] [background-image:repeating-linear-gradient(to_bottom,rgb(255_255_255/0.5)_0_1px,transparent_1px_40px),repeating-linear-gradient(to_right,rgb(255_255_255/0.35)_0_1px,transparent_1px_56px)]"
        />

        <span className="relative flex items-center gap-2.5">
          <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-white/15">
            <CalendarDays aria-hidden="true" className="size-[19px]" />
          </span>
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase">
            {tApp("titleShort")}
          </span>
        </span>

        <div className="relative max-w-[420px]">
          <h2 className="mb-4 text-[30px] leading-tight font-bold tracking-tight">
            {t("pitchTitle")}
          </h2>
          <ul className="flex flex-col gap-3">
            {POINTS.map(({ key, Icon }) => (
              <li key={key} className="flex gap-2.5 text-sm leading-relaxed text-white/90">
                <Icon aria-hidden="true" className="mt-0.5 size-[18px] flex-none" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* The office zone is a rule of the domain, not a detail of the
            schedule screen, so it is said before the first booking rather than
            after it. */}
        <p className="relative text-xs text-white/75">
          {t("pitchOffice", { zone: OFFICE_TZ })}
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-4 py-12 lg:px-10">
        <div className="flex w-full max-w-[400px] flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-accent-own-booking text-[11px] font-bold tracking-[0.14em] uppercase lg:hidden">
              {t("pitchEyebrow")}
            </p>
            <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
            <p className="text-text-tertiary text-[13px] leading-relaxed">{subtitle}</p>
          </div>

          {children}

          <p className="text-text-tertiary text-center text-[13px] leading-relaxed">
            {footerText}{" "}
            <Link href={footerLinkHref} className="text-link">
              {footerLinkText}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
