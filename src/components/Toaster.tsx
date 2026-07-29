"use client";

import { useSyncExternalStore } from "react";

import {
  dismissToast,
  readNoToast,
  readToast,
  subscribeToToast,
} from "@/components/toast";

// Confirmation of an action that already happened. It never carries the only way
// to do something, because it disappears on its own: the undo it may offer is a
// shortcut for something the interface can also do the long way.
export function Toaster() {
  const toast = useSyncExternalStore(subscribeToToast, readToast, readNoToast);

  if (!toast) {
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
      <span className="text-[13px] leading-snug font-medium">{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            dismissToast();
            toast.action?.run();
          }}
          className="focus-ring rounded-control text-surface ml-1 shrink-0 border border-current/40 px-2 py-1 text-[13px] font-semibold underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
