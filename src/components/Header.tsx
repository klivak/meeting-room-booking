import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import type { CurrentUser } from "@/lib/server/session";

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-slate-900">
          Бронювання переговорних
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
