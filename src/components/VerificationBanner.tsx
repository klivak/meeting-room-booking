"use client";

import { CircleCheck, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
      <div className="border-border-grid bg-success-surface text-success-ink border-b">
        <p className="mx-auto flex max-w-[1560px] items-center gap-3 px-4 py-2.5 text-[12.5px] font-semibold sm:px-6">
          <CircleCheck aria-hidden="true" className="size-4 flex-none" />
          {t("resendDone", { email })}
        </p>
      </div>
    );
  }

  return (
    // Warm rather than red: an unconfirmed address is a step left to take, not
    // a failure. It sits directly under the header, above everything it blocks.
    <div className="border-border-grid bg-warning-surface text-warning-ink border-b">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <Mail aria-hidden="true" className="size-4 flex-none" />
        <p className="flex-1 text-[12.5px] leading-relaxed font-semibold">
          {t("verifyBanner", { email })}
          {result === "failed" ? ` ${t("resendFailed")}` : ""}
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="focus-ring rounded-chip bg-warning-border/60 text-warning-ink min-h-11 px-3 text-xs font-bold transition hover:brightness-95 disabled:opacity-50 sm:min-h-8"
        >
          {pending ? t("resending") : t("resend")}
        </button>
      </div>
    </div>
  );
}
