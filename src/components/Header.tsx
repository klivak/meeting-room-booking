import Link from "next/link";

import { LogoutButton } from "@/components/LogoutButton";
import type { CurrentUser } from "@/lib/server/session";

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="rounded font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none">
          Бронювання переговорних
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/my-bookings"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Мої бронювання
          </Link>
          <span className="text-sm text-slate-600">{user.name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
