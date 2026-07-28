import type { Metadata } from "next";

import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = { title: "Сторінку не знайдено" };

// Shown for any address that matches no route, including for guests, so it
// cannot rely on the application layout or on a session.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-start justify-center gap-3 px-4 py-12">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Сторінку не знайдено</h1>
      <p className="text-sm text-slate-600">
        Можливо, адреса змінилася або посилання застаріло.
      </p>
      <LinkButton href="/" variant="primary">
        На головну
      </LinkButton>
    </div>
  );
}
