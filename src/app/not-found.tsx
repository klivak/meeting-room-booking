import { LogIn, MapPinOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

import { LinkButton } from "@/components/ui/LinkButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");

  return { title: t("notFoundTitle") };
}

// Shown for any address that matches no route, including for guests, so it
// cannot rely on the application layout or on a session.
export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-12">
      <div className="bg-surface border-border-grid rounded-panel shadow-panel flex w-full max-w-[420px] flex-col items-center gap-2.5 border px-7 py-10 text-center">
        <span
          aria-hidden="true"
          className="bg-surface-muted text-text-tertiary mb-1 flex size-15 items-center justify-center rounded-full"
        >
          <MapPinOff className="size-[30px]" />
        </span>
        <h1 className="text-[17px] font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-text-secondary max-w-[34ch] text-[13px] leading-relaxed">
          {t("notFoundText")}
        </p>
        <LinkButton href="/login" variant="primary" className="mt-2">
          <LogIn aria-hidden="true" className="size-4" />
          {t("notFoundAction")}
        </LinkButton>
      </div>
    </div>
  );
}
