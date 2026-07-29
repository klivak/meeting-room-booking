"use client";

import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/ui/ErrorState";

// Error boundary for the pages outside the app section, that is /login and
// /register. Without it a server failure there falls back to the framework's
// default screen, which is untranslated and offers no way out.
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col justify-center px-4 py-12">
      <ErrorState title={t("pageFailedTitle")} message={t("pageFailed")} onRetry={reset} />
    </div>
  );
}
