import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { GhostGrid } from "@/components/ui/GhostGrid";
import { LinkButton } from "@/components/ui/LinkButton";
import { getCurrentUser } from "@/lib/server/session";

// Reading the session cookie makes this page per-request, so it must not be
// rendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");

  return { title: t("notFoundTitle") };
}

// Shown for any address that matches no route, including for guests, so it
// cannot rely on the application layout. The way out depends on who is asking:
// sending a signed-in user to the login page would only bounce them back.
export default async function NotFound() {
  const t = await getTranslations("errors");
  const user = await getCurrentUser();

  return (
    <div className="bg-surface-sunken relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-12">
      <GhostGrid />
      <div className="relative flex max-w-[38ch] flex-col items-center gap-3.5 text-center">
        {/* The number is the illustration, not the message: at 84px in the mono
            face it reads as a missing slot on the grid behind it. The sentence
            under it is the heading, so the page still announces itself. */}
        <span
          aria-hidden="true"
          className="font-mono text-[84px] leading-none font-bold tracking-[-0.04em]"
        >
          404
        </span>
        <h1 className="text-xl font-extrabold tracking-[-0.02em]">
          {t("notFoundTitle")}
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed text-balance">
          {user ? t("notFoundTextAuthed") : t("notFoundText")}
        </p>
        <LinkButton
          href={user ? "/" : "/login"}
          variant="primary"
          className="mt-1.5 min-h-12 px-6 text-sm"
        >
          {user ? t("notFoundActionAuthed") : t("notFoundAction")}
        </LinkButton>
      </div>
    </div>
  );
}
