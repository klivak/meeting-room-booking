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
      <Header user={user} />
      {user.emailVerified ? null : <VerificationBanner />}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
