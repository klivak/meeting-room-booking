"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";

// How long the "sent" confirmation stays before the banner goes back to asking:
// long enough to read, short enough that it does not look like the address is
// confirmed already.
const CONFIRMATION_MS = 6000;

/**
 * Shown to a user whose address is not confirmed yet. It states plainly where
 * the link is, because in development it goes to the server log rather than to
 * an inbox. While it is up, booking is closed — the grid says so too.
 */
export function VerificationBanner({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | null>(null);

  useEffect(() => {
    if (result !== "sent") {
      return;
    }

    const timer = setTimeout(() => setResult(null), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [result]);

  async function resend() {
    setPending(true);
    setResult(null);

    const response = await fetch("/api/auth/verification", { method: "POST" }).catch(
      () => null,
    );

    setResult(response?.ok ? "sent" : "failed");
    setPending(false);
  }

  if (result === "sent") {
    return (
      <div className="border-success bg-success-surface text-success-ink border-b">
        <p className="mx-auto max-w-[1560px] px-4 py-3 text-[13px] leading-relaxed">
          <span aria-hidden="true" className="mr-2 font-bold">
            ✓
          </span>
          {t("resendDone", { email })}
        </p>
      </div>
    );
  }

  return (
    <div className="border-warning-border bg-warning-surface text-warning-ink border-b">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-3 px-4 py-3">
        <span aria-hidden="true" className="font-bold">
          !
        </span>
        <p className="flex-1 text-[13px] leading-relaxed">
          {t("verifyBanner", { email })}
          {result === "failed" ? ` ${t("resendFailed")}` : ""}
        </p>
        <Button variant="secondary" size="sm" onClick={resend} disabled={pending}>
          {pending ? t("resending") : t("resend")}
        </Button>
      </div>
    </div>
  );
}
