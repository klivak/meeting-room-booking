import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandPanel } from "@/components/auth/BrandPanel";
import { LogoMark } from "@/components/ui/LogoMark";

// The frame shared by sign-in and registration: a split screen from lg up, one
// narrow column below it. A 1920px screen with a 384px card floating in the
// middle of it reads as a page that failed to load.
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
  const tApp = await getTranslations("app");

  return (
    // dvh rather than a percentage: body only carries a min-height, so a
    // percentage one here resolves to auto and the brand panel stops halfway
    // down the screen.
    <div className="flex min-h-dvh w-full lg:grid lg:grid-cols-2">
      <BrandPanel />

      <div className="bg-surface-sunken relative flex flex-1 items-center justify-center px-4 py-12 lg:px-12">
        <span aria-hidden="true" className="app-bloom pointer-events-none absolute inset-0" />

        <div className="relative flex w-full max-w-[384px] flex-col gap-[22px]">
          {/* Below lg the brand panel is hidden, so without this the form asks
              for a password without ever naming what it signs you into. */}
          <div className="flex items-center gap-3 lg:hidden">
            <LogoMark className="size-9 rounded-[10px] p-[9px]" />
            <span className="text-[17px] font-extrabold tracking-[-0.01em]">{tApp("title")}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{title}</h1>
            <p className="text-text-secondary text-sm leading-relaxed">{subtitle}</p>
          </div>

          {children}

          <p className="text-text-secondary text-center text-[13.5px]">
            {footerText}{" "}
            <Link href={footerLinkHref} className="text-link no-underline">
              {footerLinkText}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
