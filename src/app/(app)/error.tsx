"use client";

import { ErrorState } from "@/components/ui/ErrorState";

// Catches a failed data load (for example the database being unreachable) so
// the user sees a retry button instead of a blank screen.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
