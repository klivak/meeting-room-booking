"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations("app");
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);

    // refresh() re-runs the layout guard, which now sees a guest and redirects.
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      // Important, because two competing min-widths in one class list are
      // settled by the stylesheet and not by the order they are written in: the
      // 96px floor every button carries is what pushed this one off the right
      // edge of a 768px header.
      className="min-w-0! px-3"
      onClick={handleLogout}
      disabled={pending}
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? t("loggingOut") : t("logout")}
    </Button>
  );
}
