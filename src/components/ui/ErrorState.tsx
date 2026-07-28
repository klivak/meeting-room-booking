"use client";

import { Button } from "@/components/ui/Button";

// Every failure the user can see ends up here: a plain explanation plus a way
// to try again, because a dead end is worse than the error itself.
export function ErrorState({
  message = "Не вдалося завантажити дані. Перевірте зʼєднання і спробуйте ще раз.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm text-red-700">{message}</p>
      <Button onClick={onRetry}>Спробувати ще раз</Button>
    </div>
  );
}
