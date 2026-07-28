"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MAX_NAME_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/domain/auth";

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
        password: formData.get("password"),
      }),
    }).catch(() => null);

    if (response?.ok) {
      // Registration already created the session, so we can go straight to the app.
      router.replace("/");
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);
    setError(
      body?.error ?? { code: "UNKNOWN", message: t("registerFailed") },
    );
    setPending(false);
  }

  const fieldError = (field: string) =>
    error?.field === field ? error.message : undefined;
  const generalError = error && !error.field ? error.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {generalError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {generalError}
        </p>
      ) : null}

      <Input
        id="name"
        name="name"
        label={t("name")}
        autoComplete="name"
        maxLength={MAX_NAME_LENGTH}
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
      <Input
        id="password"
        name="password"
        type="password"
        label={t("password")}
        autoComplete="new-password"
        maxLength={MAX_PASSWORD_LENGTH}
        required
        error={fieldError("password")}
      />

      <Button type="submit" disabled={pending}>
        {pending ? t("signingUp") : t("signUp")}
      </Button>
    </form>
  );
}
