"use client";

import { useSyncExternalStore } from "react";

import { readNoToast, readToast, subscribeToToast } from "@/components/toast";

export function Toaster() {
  const message = useSyncExternalStore(subscribeToToast, readToast, readNoToast);

  if (!message) {
    return null;
  }

  return (
    <p
      role="status"
      className="fixed right-4 bottom-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
    >
      {message}
    </p>
  );
}
