import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("registerTitle")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("registerSubtitle")}
        </p>
      </div>

      <RegisterForm />

      <p className="text-sm text-slate-600">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
