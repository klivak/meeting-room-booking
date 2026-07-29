import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { HeaderMenu } from "@/components/HeaderMenu";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CurrentUser } from "@/lib/server/session";

export async function Header({ user }: { user: CurrentUser }) {
  const t = await getTranslations("app");

  return (
    <header className="border-border-grid bg-surface relative z-30 border-b">
      {/* Below sm everything but the title and the bell moves into the menu:
          on a 360px screen the row used to wrap, and a header two rows deep ate
          a tenth of the screen on every page. */}
      <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-x-3 px-4">
        {/* The short name on a phone: at 360px the full one pushes the controls
            onto a third row, and a header three rows deep eats a fifth of the
            screen on every screen. */}
        <Link
          href="/"
          className="focus-ring text-text-primary rounded text-[15px] font-bold tracking-tight no-underline"
        >
          <span className="sm:hidden">{t("titleShort")}</span>
          <span className="hidden sm:inline">{t("title")}</span>
        </Link>

        <Link
          href="/my-bookings"
          className="focus-ring text-text-secondary hover:text-text-primary hover:bg-surface-muted rounded-control hidden px-2.5 py-1.5 text-sm font-medium no-underline transition sm:block"
        >
          {t("myBookings")}
        </Link>

        <span className="flex-1" />

        {/* The bell stays out of the menu: a notification nobody can see until
            they open a menu is not a notification. */}
        <NotificationBell />

        <span className="text-text-secondary hidden text-sm md:inline">{user.name}</span>

        <div className="hidden items-center gap-3 sm:flex">
          <LocaleSwitcher />
          <ThemeToggle />
          <LogoutButton />
        </div>

        <HeaderMenu label={t("menu")}>
          <p className="text-text-tertiary px-1 text-xs font-semibold">{user.name}</p>

          <Link
            href="/my-bookings"
            className="focus-ring text-text-primary hover:bg-surface-muted rounded-control flex min-h-11 items-center px-2.5 text-sm font-medium no-underline transition"
          >
            {t("myBookings")}
          </Link>

          <div className="border-border-grid-half flex items-center gap-2 border-t pt-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          <LogoutButton />
        </HeaderMenu>
      </div>
    </header>
  );
}
