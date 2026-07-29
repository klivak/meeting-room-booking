"use client";

import { ErrorState } from "@/components/ui/ErrorState";

// Catches a failed data load (for example the database being unreachable) so
// the user sees an explanation and a retry button instead of a blank screen.
// The header and the way out stay in place above it.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <ErrorState onRetry={reset} />
    </div>
  );
}
