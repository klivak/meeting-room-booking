import { ArrowLeft, DoorOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LinkButton } from "@/components/ui/LinkButton";

// Handles notFound() raised inside the application, for example a room id that
// no longer exists. Rendered inside the app layout, so the header and the way
// back stay in place.
export default async function AppNotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="border-border-grid bg-surface rounded-card shadow-rest mx-auto flex w-full max-w-[420px] flex-col items-center gap-2.5 border px-7 py-10 text-center">
      <span
        aria-hidden="true"
        className="bg-surface-muted text-text-tertiary mb-1 flex size-15 items-center justify-center rounded-full"
      >
        <DoorOpen className="size-[30px]" />
      </span>
      <h1 className="text-[17px] font-semibold">{t("appNotFoundTitle")}</h1>
      <p className="text-text-secondary max-w-[36ch] text-[13px] leading-relaxed">
        {t("appNotFoundText")}
      </p>
      <LinkButton href="/" variant="secondary" className="mt-2">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("appNotFoundAction")}
      </LinkButton>
    </div>
  );
}
