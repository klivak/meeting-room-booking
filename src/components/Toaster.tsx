"use client";

import { CircleCheck, Undo2 } from "lucide-react";
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
      // A card rather than an inverted bar: it sits over the grid, and the one
      // dark rectangle on the screen read as an error whatever it said.
      className="bg-surface border-border-grid text-text-primary shadow-panel animate-toast rounded-card fixed right-5 bottom-5 z-80 flex max-w-[360px] items-center gap-3 border px-4 py-3.5"
    >
      <span className="bg-success-surface rounded-chip flex size-[30px] shrink-0 items-center justify-center">
        <CircleCheck
          aria-hidden="true"
          className="text-success size-4"
          strokeWidth={2.4}
        />
      </span>
      <span className="flex-1 text-[13.5px] leading-snug font-bold">
        {toast.message}
      </span>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            dismissToast();
            toast.action?.run();
          }}
          className="focus-ring rounded-chip bg-accent-own-surface text-accent-own-ink flex shrink-0 items-center gap-1.5 px-3 py-[7px] text-[12.5px] font-bold transition hover:brightness-95"
        >
          <Undo2 aria-hidden="true" className="size-3.5" />
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}
