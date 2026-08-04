import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { HeaderMenu } from "@/components/HeaderMenu";
import { HeaderNav } from "@/components/HeaderNav";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark } from "@/components/ui/LogoMark";
import type { CurrentUser } from "@/lib/server/session";

export async function Header({ user }: { user: CurrentUser }) {
  const t = await getTranslations("app");

  return (
    <header className="border-border-grid bg-surface relative z-30 border-b">
      {/* 60px tall: the whole week has to fit a 1366x768 laptop without the page
          scrolling, and every pixel spent here is a pixel taken from the grid.
          Below sm everything but the mark and the bell moves into the menu — on
          a 360px screen the row used to wrap onto a second line. */}
      <div className="mx-auto flex h-15 max-w-[1560px] items-center gap-x-2.5 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-ring rounded-control text-text-primary flex items-center gap-[11px] no-underline"
        >
          <LogoMark />
          <strong className="text-[15px] font-extrabold tracking-[-0.01em]">
            {t("titleShort")}
          </strong>
        </Link>

        <HeaderNav roomsLabel={t("rooms")} myBookingsLabel={t("myBookings")} />

        <span className="flex-1" />

        {/* The bell stays out of the menu: a notification nobody can see until
            they open a menu is not a notification. */}
        <NotificationBell />

        <div className="hidden items-center gap-2.5 sm:flex">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>

        <div className="hidden items-center gap-[9px] pl-1 sm:flex">
          <Avatar name={user.name} />
          <span className="text-text-primary hidden text-[13px] font-semibold md:inline">
            {user.name}
          </span>
        </div>

        <div className="hidden sm:block">
          <LogoutButton />
        </div>

        <HeaderMenu label={t("menu")}>
          <div className="flex items-center gap-2.5 px-1 pb-1">
            <Avatar name={user.name} />
            <span className="text-text-primary text-[13px] font-semibold">
              {user.name}
            </span>
          </div>

          <Link
            href="/my-bookings"
            className="focus-ring text-text-primary hover:bg-surface-muted rounded-control flex min-h-11 items-center px-2.5 text-sm font-semibold no-underline transition"
          >
            {t("myBookings")}
          </Link>

          <div className="border-border-grid flex items-center gap-2 border-t pt-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>

          <LogoutButton />
        </HeaderMenu>
      </div>
    </header>
  );
}
