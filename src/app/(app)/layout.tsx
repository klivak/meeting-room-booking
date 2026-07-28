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
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      {/* First stop for a keyboard, so the grid full of cells can be jumped over. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Перейти до вмісту
      </a>
      <Header user={user} />
      {user.emailVerified ? null : <VerificationBanner />}
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
