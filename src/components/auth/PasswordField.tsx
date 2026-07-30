"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Input } from "@/components/ui/Input";

type PasswordFieldProps = Omit<React.ComponentProps<typeof Input>, "type">;

/**
 * A password field that can be read back. Typing a password blind is the reason
 * people get "wrong email or password" twice in a row, and on a phone keyboard
 * it is the difference between signing in and giving up.
 *
 * The button is deliberately not a checkbox: it toggles what is on screen right
 * now, so its label says what pressing it will do.
 */
export function PasswordField({ value, ...props }: PasswordFieldProps) {
  const t = useTranslations("auth");
  const [revealed, setRevealed] = useState(false);

  return (
    <Input
      {...props}
      value={value}
      type={revealed ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          aria-pressed={revealed}
          aria-label={revealed ? t("hidePassword") : t("showPassword")}
          title={revealed ? t("hidePassword") : t("showPassword")}
          className="focus-ring-tight text-text-tertiary hover:text-text-primary hover:bg-surface-muted rounded-control flex h-9 w-10 items-center justify-center transition"
        >
          {revealed ? (
            <EyeOff aria-hidden="true" className="size-[18px]" />
          ) : (
            <Eye aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      }
    />
  );
}
