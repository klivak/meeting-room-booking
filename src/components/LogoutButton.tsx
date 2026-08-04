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
      className="min-w-0 px-3"
      onClick={handleLogout}
      disabled={pending}
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? t("loggingOut") : t("logout")}
    </Button>
  );
}
