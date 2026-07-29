"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
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
        required
        error={fieldError("email")}
      />
      <Input
        id="password"
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
