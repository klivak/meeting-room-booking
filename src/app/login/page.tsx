import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage() {
  // A signed-in user has nothing to do here.
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Вхід</h1>
        <p className="mt-1 text-sm text-slate-600">
          Увійдіть, щоб бачити розклад переговорних.
        </p>
      </div>

      <LoginForm />

      <p className="text-sm text-slate-600">
        Ще немає акаунта?{" "}
        <Link href="/register" className="font-medium text-slate-900 underline">
          Зареєструватися
        </Link>
      </p>
    </div>
  );
}
