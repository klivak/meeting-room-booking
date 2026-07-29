"use client";

import { useSyncExternalStore } from "react";

import { readNoToast, readToast, subscribeToToast } from "@/components/toast";

// Confirmation of an action that already happened. It never carries the only
// way to do something, because it disappears after four seconds.
export function Toaster() {
  const message = useSyncExternalStore(subscribeToToast, readToast, readNoToast);

  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-text-primary text-surface shadow-modal animate-toast rounded-control fixed right-5 bottom-5 z-80 flex max-w-[340px] items-center gap-2.5 px-3.5 py-3"
    >
      <span
        aria-hidden="true"
        className="bg-success flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      >
        ✓
      </span>
      <span className="text-[13px] leading-snug font-medium">{message}</span>
    </div>
  );
}
