"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/domain/auth";

type ApiError = {
  code: string;
  message: string;
  field?: string;
};

export function RegisterForm() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  // Controlled so the length of the password can be shown while it is typed.
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password,
      }),
    }).catch(() => null);

    if (response?.ok) {
      // Registration already created the session, so we can go straight to the app.
      router.replace("/");
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);
    setError(body?.error ?? { code: "UNKNOWN", message: t("registerFailed") });
    setPending(false);
  }

  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;
  const generalError = error && !error.field ? error.message : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-[18px]"
      noValidate
    >
      {/* Above the form: "this address is already registered" is not a fault of
          any single field the user is looking at. */}
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
        id="name"
        name="name"
        label={t("name")}
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        required
        error={fieldError("name")}
      />
      <Input
        id="email"
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        error={fieldError("email")}
      />
      <PasswordField
        id="password"
        name="password"
        label={t("password")}
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError("password")}
        // The rule, then the progress towards it. Learning about the eight
        // characters from a refused submit is learning it too late; the server
        // still checks it, this only says it sooner.
        labelSuffix={
          <span
            className={`font-mono text-[11px] ${
              password.length >= MIN_PASSWORD_LENGTH
                ? "text-success-ink"
                : "text-text-tertiary"
            }`}
          >
            {password.length === 0
              ? t("passwordHint", { min: MIN_PASSWORD_LENGTH })
              : password.length < MIN_PASSWORD_LENGTH
                ? `${password.length}/${MIN_PASSWORD_LENGTH}`
                : `✓ ${password.length}`}
          </span>
        }
      />

      <Button
        type="submit"
        size="lg"
        className="mt-0.5 h-12 w-full text-[15px]"
        disabled={pending}
      >
        {pending ? t("signingUp") : t("signUp")}
      </Button>
    </form>
  );
}
