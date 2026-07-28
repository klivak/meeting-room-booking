"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";

/**
 * Shown to a user whose address is not confirmed yet. It states plainly where
 * the link is, because in development it goes to the server log rather than to
 * an inbox.
 */
export function VerificationBanner() {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);

    const response = await fetch("/api/auth/verification", { method: "POST" }).catch(
      () => null,
    );

    showToast(
      response?.ok ? t("resendDone") : t("resendFailed"),
    );
    setPending(false);
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-amber-900">
          {t("verifyBanner")}
        </p>
        <Button variant="ghost" onClick={resend} disabled={pending}>
          {pending ? t("resending") : t("resend")}
        </Button>
      </div>
    </div>
  );
}
