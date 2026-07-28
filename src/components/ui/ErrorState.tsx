"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

// Every failure the user can see ends up here: a plain explanation plus a way
// to try again, because a dead end is worse than the error itself.
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm text-red-700">{message ?? t("loadFailed")}</p>
      <Button onClick={onRetry}>{t("retry")}</Button>
    </div>
  );
}
