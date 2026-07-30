"use client";

import { RotateCw, WifiOff } from "lucide-react";
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
    <div className="border-border-grid bg-surface rounded-card shadow-rest flex flex-col items-center gap-2.5 border p-8 text-center">
      {/* The badge names the failure before the sentence does; danger-tinted
          rather than a red border round the whole card, which reads as "this
          block is broken" instead of "the load is". */}
      <span
        aria-hidden="true"
        className="bg-danger-surface text-danger mb-1 flex size-15 items-center justify-center rounded-full"
      >
        <WifiOff className="size-[30px]" />
      </span>
      <p className="text-[17px] font-semibold">{title ?? t("loadFailedTitle")}</p>
      <p className="text-text-secondary max-w-[44ch] text-[13px] leading-relaxed">
        {message ?? t("loadFailed")}
      </p>
      <Button className="mt-2" onClick={onRetry}>
        <RotateCw aria-hidden="true" className="size-4" />
        {t("retry")}
      </Button>
    </div>
  );
}
