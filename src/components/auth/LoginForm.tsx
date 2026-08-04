"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DEMO_LOGIN } from "@/lib/config";
import { DEMO_ACCOUNTS } from "@/lib/demoAccounts";

type ApiError = {
  code: string;
  message: string;
  field?: string;
};

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  // Controlled so the demo button can fill them in.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);

    if (response?.ok) {
      // Stays pending until the navigation happens, so the form cannot be submitted twice.
      router.replace("/");
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);
    setError(
      body?.error ?? { code: "UNKNOWN", message: t("loginFailed") },
    );
    setPending(false);
  }

  // Errors tied to a field go under that field; everything else goes above the form.
  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;
  const generalError = error && !error.field ? error.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
      {/* Above the form, not beside a field: "wrong email or password" is about
          the pair, and pointing at one of them would be a guess. */}
      {generalError ? (
        <p
          role="alert"
          className="border-danger-border bg-danger-surface text-danger-ink rounded-control flex items-start gap-2.5 border px-3.5 py-3 text-[13px] leading-snug font-semibold"
        >
          <CircleAlert aria-hidden="true" className="mt-px size-4 flex-none" />
          {generalError}
        </p>
      ) : null}

      <Input
        id="email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        // Nothing else on this screen competes for the first keystroke.
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError("email")}
      />
      <PasswordField
        id="password"
        name="password"
        label={t("password")}
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError("password")}
      />

      <Button type="submit" size="lg" className="mt-0.5 h-12 w-full text-[15px]" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>

      {/* Off unless NEXT_PUBLIC_DEMO_LOGIN says otherwise: it fills the form
          with the credentials the seed creates, which is a convenience for
          whoever is reviewing the project rather than a feature of it. */}
      {DEMO_LOGIN ? (
        <p className="border-border-grid bg-surface-muted rounded-control flex flex-wrap items-center gap-2.5 border border-dashed px-3.5 py-3">
          <span className="text-text-tertiary font-mono text-[11px] font-bold tracking-wider">
            {t("demoBadge")}
          </span>
          <span className="text-text-secondary text-[12.5px]">{t("demoHint")}</span>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_ACCOUNTS[0].email);
              setPassword(DEMO_ACCOUNTS[0].password);
              setError(null);
            }}
            className="focus-ring text-accent-own-ink ml-auto rounded text-xs font-bold"
          >
            {t("demoFill")} →
          </button>
        </p>
      ) : null}
    </form>
  );
}
