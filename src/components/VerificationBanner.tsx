"use client";

import { useState } from "react";

import { showToast } from "@/components/toast";
import { Button } from "@/components/ui/Button";

/**
 * Shown to a user whose address is not confirmed yet. It states plainly where
 * the link is, because in development it goes to the server log rather than to
 * an inbox.
 */
export function VerificationBanner() {
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);

    const response = await fetch("/api/auth/verification", { method: "POST" }).catch(
      () => null,
    );

    showToast(
      response?.ok
        ? "Нове посилання у лозі сервера"
        : "Не вдалося надіслати. Спробуйте ще раз",
    );
    setPending(false);
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-amber-900">
          Підтвердьте електронну пошту, щоб бронювати. Посилання надруковане в лозі
          сервера.
        </p>
        <Button variant="ghost" onClick={resend} disabled={pending}>
          {pending ? "Надсилаємо…" : "Надіслати ще раз"}
        </Button>
      </div>
    </div>
  );
}
