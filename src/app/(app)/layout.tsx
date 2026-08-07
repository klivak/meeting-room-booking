import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { Toaster } from "@/components/Toaster";
import { VerificationBanner } from "@/components/VerificationBanner";
import { getCurrentUser } from "@/lib/server/session";

// Nothing in here is meant for a search engine: a crawler only ever sees the
// redirect to /login, and a room address that leaked into an index would point
// at a page nobody can open.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Single guard for the whole application: everything inside this route group
// requires a session. /login and /register live outside it, so they stay public.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations("app"),
  ]);
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="bg-surface-sunken relative flex min-h-full flex-col">
      {/* One jade bloom off the top right corner. It is what stops a page of
          white cards from reading as a spreadsheet, and it costs one element. */}
      <span
        aria-hidden="true"
        className="app-bloom pointer-events-none fixed inset-0"
      />
      {/* First stop for a keyboard, so the grid full of cells can be jumped over. */}
      <a
        href="#main"
        className="focus:bg-accent-own-ink focus:text-accent-own-on focus:shadow-panel sr-only focus:not-sr-only focus:absolute focus:top-2.5 focus:left-3 focus:z-90 focus:rounded-control focus:px-3 focus:py-2 focus:text-xs focus:font-semibold"
      >
        {t("skipToContent")}
      </a>
      <Header user={user} />
      {user.emailVerified ? null : <VerificationBanner email={user.email} />}
      {/* Tighter vertically than horizontally on purpose: the twenty half-hour
          rows of a week have to fit a 1366×768 laptop without the page
          scrolling, and every 8px of padding is 8px taken from the grid. */}
      {/* overflow-x-clip, not hidden: the capacity filter bleeds past the page
          padding on purpose so its chips scroll edge to edge, and without a clip
          those 16px became a horizontal scrollbar for the whole phone screen.
          `clip` does not create a scroll container, so the sticky pieces inside
          the schedule keep sticking to the viewport. */}
      <main
        id="main"
        className="relative mx-auto w-full max-w-[1560px] flex-1 overflow-x-clip px-4 py-4 sm:px-6 lg:py-3"
      >
        {children}
      </main>
      <Toaster />
    </div>
  );
}
