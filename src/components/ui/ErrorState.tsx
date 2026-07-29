"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

// Every failure the user can see ends up here: what happened, what it did not
// break, and a way to try again — a dead end is worse than the error itself.
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="border-danger bg-surface rounded-card flex flex-col items-start gap-2 border p-6">
      <p className="text-danger-ink text-[15px] font-semibold">
        {title ?? t("loadFailedTitle")}
      </p>
      <p className="text-text-secondary max-w-[44ch] text-[13px] leading-relaxed">
        {message ?? t("loadFailed")}
      </p>
      <Button className="mt-1" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
