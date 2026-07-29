import { getTranslations } from "next-intl/server";

import { LinkButton } from "@/components/ui/LinkButton";

// Handles notFound() raised inside the application, for example a room id that
// no longer exists. Rendered inside the app layout, so the header and the way
// back stay in place.
export default async function AppNotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="border-border-grid bg-surface rounded-card mx-auto flex w-full max-w-[420px] flex-col items-center gap-2.5 border px-7 py-10 text-center">
      <h1 className="text-[17px] font-semibold">{t("appNotFoundTitle")}</h1>
      <p className="text-text-secondary max-w-[36ch] text-[13px] leading-relaxed">
        {t("appNotFoundText")}
      </p>
      <LinkButton href="/" className="mt-1">
        {t("appNotFoundAction")}
      </LinkButton>
    </div>
  );
}
