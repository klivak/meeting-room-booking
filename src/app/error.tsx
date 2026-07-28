"use client";

// Error boundary for the pages outside the app section, that is /login and
// /register. Without it a server failure there falls back to the framework's
// default screen, which is untranslated and offers no way out.
export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col items-start justify-center gap-3 px-4 py-12">
      <h1 className="text-lg font-semibold text-slate-900">Щось пішло не так</h1>
      <p className="text-sm text-slate-600">
        Сторінку не вдалося завантажити. Перевірте зʼєднання і спробуйте ще раз.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Спробувати ще раз
      </button>
    </div>
  );
}
