"use client";

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
          {/* Drawn rather than an emoji, for the same reason as the bell: an
              emoji is coloured by the system font and ignores the theme. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12" />
            <circle cx="12" cy="12" r="2.6" />
            {/* The stroke through the eye is the whole difference between the
                two states, so it is the only thing that appears. */}
            {revealed ? <path d="M4 20 20 4" /> : null}
          </svg>
        </button>
      }
    />
  );
}
