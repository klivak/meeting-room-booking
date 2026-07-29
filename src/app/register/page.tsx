import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");

  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");

  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <AuthCard
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footerText={t("haveAccount")}
      footerLinkHref="/login"
      footerLinkText={t("signIn")}
    >
      <RegisterForm />
    </AuthCard>
  );
}
