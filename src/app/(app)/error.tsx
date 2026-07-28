"use client";

import { Button } from "@/components/ui/Button";

// Catches a failed data load (for example the database being unreachable) so
// the user sees a retry button instead of a blank screen.
export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="text-sm text-red-700">
        Не вдалося завантажити дані. Перевірте зʼєднання і спробуйте ще раз.
      </p>
      <Button onClick={reset}>Спробувати ще раз</Button>
    </div>
  );
}
