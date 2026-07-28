import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("loginSubtitle")}
        </p>
      </div>

      <LoginForm />

      <p className="text-sm text-slate-600">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-slate-900 underline">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
