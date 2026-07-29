"use client";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Above the form, not beside a field: "wrong email or password" is about
          the pair, and pointing at one of them would be a guess. */}
      {generalError ? (
        <p
          role="alert"
          className="bg-danger-surface border-danger text-danger-ink rounded-control flex gap-2 border px-3 py-2.5 text-[13px] leading-snug"
        >
          <span aria-hidden="true" className="font-bold">
            !
          </span>
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

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>

      {/* Off unless NEXT_PUBLIC_DEMO_LOGIN says otherwise: it fills the form
          with the credentials the seed creates, which is a convenience for
          whoever is reviewing the project rather than a feature of it. */}
      {DEMO_LOGIN ? (
        <p className="border-border-grid text-text-tertiary flex flex-wrap items-center gap-2 border-t pt-3 text-[13px]">
          {t("demoHint")}
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_ACCOUNTS[0].email);
              setPassword(DEMO_ACCOUNTS[0].password);
              setError(null);
            }}
            className="focus-ring text-link rounded bg-transparent"
          >
            {t("demoFill")}
          </button>
        </p>
      ) : null}
    </form>
  );
}
