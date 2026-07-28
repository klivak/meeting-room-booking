"use client";

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
      body?.error ?? {
        code: "UNKNOWN",
        message: "Не вдалося увійти. Спробуйте ще раз",
      },
    );
    setPending(false);
  }

  // Errors tied to a field go under that field; everything else goes above the form.
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
        id="email"
        name="email"
        type="email"
        label="Електронна пошта"
        autoComplete="email"
        required
        error={fieldError("email")}
      />
      <Input
        id="password"
        name="password"
        type="password"
        label="Пароль"
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Входимо…" : "Увійти"}
      </Button>
    </form>
  );
}
