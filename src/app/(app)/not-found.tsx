import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GhostGrid } from "@/components/ui/GhostGrid";
import { LinkButton } from "@/components/ui/LinkButton";

// Handles notFound() raised inside the application, for example a room id that
// no longer exists. Rendered inside the app layout, so the header and the way
// back stay in place.
export default async function AppNotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="border-border-grid bg-surface rounded-card shadow-card relative mx-auto flex min-h-[380px] w-full max-w-[560px] items-center justify-center overflow-hidden border px-7 py-12">
      <GhostGrid />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-[64px] leading-none font-bold tracking-[-0.04em]">
          404
        </span>
        <h1 className="text-xl font-extrabold tracking-[-0.02em]">
          {t("appNotFoundTitle")}
        </h1>
        <p className="text-text-secondary max-w-[36ch] text-sm leading-relaxed">
          {t("appNotFoundText")}
        </p>
        <LinkButton href="/" variant="primary" className="mt-2">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("appNotFoundAction")}
        </LinkButton>
      </div>
    </div>
  );
}
