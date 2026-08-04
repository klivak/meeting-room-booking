import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");

  return { title: t("loginTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");

  // A signed-in user has nothing to do here.
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <AuthCard
      title={t("loginHeading")}
      subtitle={t("loginSubtitle")}
      footerText={t("noAccount")}
      footerLinkHref="/register"
      footerLinkText={t("signUp")}
    >
      <LoginForm />
    </AuthCard>
  );
}
