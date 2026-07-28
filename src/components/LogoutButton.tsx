"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);

    // refresh() re-runs the layout guard, which now sees a guest and redirects.
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleLogout} disabled={pending}>
      {pending ? "Виходимо…" : "Вийти"}
    </Button>
  );
}
