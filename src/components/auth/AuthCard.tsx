import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { OFFICE_TZ } from "@/lib/domain/constants";

// The frame shared by sign-in and registration. One narrow column on a small
// screen, because there is nothing else to do here; from lg up the column is
// paired with a panel saying what the application is, since a 1920px screen with
// a 376px card floating in the middle of it reads as a page that failed to load.
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
  const points = ["pitchGrid", "pitchOwn", "pitchZone"] as const;

  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[376px] items-center gap-14 lg:max-w-4xl">
        {/* Text only, no illustration: it has to survive translation and both
            themes, and a screenshot of the grid would go stale the first time
            the grid changes. */}
        <div className="hidden min-w-0 flex-1 flex-col gap-5 lg:flex">
          <div className="flex flex-col gap-2">
            <p className="text-text-tertiary text-xs font-semibold tracking-wide uppercase">
              {t("pitchEyebrow")}
            </p>
            <h2 className="text-[26px] leading-tight font-semibold tracking-tight">
              {t("pitchTitle")}
            </h2>
          </div>

          <ul className="flex flex-col gap-3">
            {points.map((point) => (
              <li
                key={point}
                className="text-text-secondary flex gap-2.5 text-sm leading-relaxed"
              >
                <span aria-hidden="true" className="text-accent-own-booking font-bold">
                  —
                </span>
                {t(point)}
              </li>
            ))}
          </ul>

          {/* The office zone is a rule of the domain, not a detail of the
              schedule screen, so it is said before the first booking rather
              than after it. */}
          <p className="border-border-grid text-text-tertiary border-t pt-4 text-[13px] leading-relaxed">
            {t("pitchOffice", { zone: OFFICE_TZ })}
          </p>
        </div>

        <div className="bg-surface border-border-grid rounded-panel shadow-panel flex w-full flex-col gap-4 border px-7 py-8 lg:w-[376px] lg:flex-none">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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
