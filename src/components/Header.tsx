import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import type { CurrentUser } from "@/lib/server/session";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none";

export async function Header({ user }: { user: CurrentUser }) {
  const t = await getTranslations("app");

  return (
    <header className="border-b border-slate-200 bg-white">
      {/* On a narrow screen the two groups wrap onto separate lines instead of
          squeezing, and the user name gives way first since the actions matter more. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className={`rounded text-sm font-semibold text-slate-900 sm:text-base ${FOCUS_RING}`}
        >
          {t("title")}
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/my-bookings"
            className={`rounded text-sm text-slate-600 transition hover:text-slate-900 ${FOCUS_RING}`}
          >
            {t("myBookings")}
          </Link>
          <NotificationBell />
          <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
          <LocaleSwitcher />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
