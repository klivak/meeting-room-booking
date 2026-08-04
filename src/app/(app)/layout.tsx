import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { Toaster } from "@/components/Toaster";
import { VerificationBanner } from "@/components/VerificationBanner";
import { getCurrentUser } from "@/lib/server/session";

// Single guard for the whole application: everything inside this route group
// requires a session. /login and /register live outside it, so they stay public.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("app")]);
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="bg-surface-sunken relative flex min-h-full flex-col">
      {/* One jade bloom off the top right corner. It is what stops a page of
          white cards from reading as a spreadsheet, and it costs one element. */}
      <span aria-hidden="true" className="app-bloom pointer-events-none fixed inset-0" />
      {/* First stop for a keyboard, so the grid full of cells can be jumped over. */}
      <a
        href="#main"
        className="focus:bg-accent-own-booking focus:text-accent-own-on focus:shadow-panel sr-only focus:not-sr-only focus:absolute focus:top-2.5 focus:left-3 focus:z-90 focus:rounded-control focus:px-3 focus:py-2 focus:text-xs focus:font-semibold"
      >
        {t("skipToContent")}
      </a>
      <Header user={user} />
      {user.emailVerified ? null : <VerificationBanner email={user.email} />}
      {/* Tighter vertically than horizontally on purpose: the twenty half-hour
          rows of a week have to fit a 1366×768 laptop without the page
          scrolling, and every 8px of padding is 8px taken from the grid. */}
      <main id="main" className="relative mx-auto w-full max-w-[1560px] flex-1 px-4 py-4 sm:px-6">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
