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
    <div className="border-border-grid bg-surface rounded-card shadow-card flex flex-col items-center gap-3 border p-10 text-center">
      {/* The badge names the failure before the sentence does; danger-tinted
          rather than a red border round the whole card, which reads as "this
          block is broken" instead of "the load is". */}
      <span
        aria-hidden="true"
        className="bg-danger-surface text-danger rounded-panel mb-1 flex size-[46px] items-center justify-center"
      >
        <WifiOff className="size-[22px]" />
      </span>
      <p className="text-xl font-extrabold tracking-[-0.02em]">
        {title ?? t("loadFailedTitle")}
      </p>
      <p className="text-text-secondary max-w-[44ch] text-sm leading-relaxed">
        {message ?? t("loadFailed")}
      </p>
      <Button className="mt-2" onClick={onRetry}>
        <RotateCw aria-hidden="true" className="size-4" />
        {t("retry")}
      </Button>
    </div>
  );
}
