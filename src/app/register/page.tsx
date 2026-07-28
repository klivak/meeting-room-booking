import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function RegisterPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Реєстрація</h1>
        <p className="mt-1 text-sm text-slate-600">
          Створіть акаунт, щоб бронювати переговорні.
        </p>
      </div>

      <RegisterForm />

      <p className="text-sm text-slate-600">
        Вже маєте акаунт?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Увійти
        </Link>
      </p>
    </div>
  );
}
