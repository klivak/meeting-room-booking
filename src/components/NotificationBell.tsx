"use client";

import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { showToast } from "@/components/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  noopSubscribe,
  readOfficeTimeZone,
  readViewerTimeZone,
} from "@/components/viewerTimeZone";

type Notification = {
  id: string;
  bookingId: string;
  title: string;
  roomName: string;
  endsAt: string;
};

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const t = useTranslations("notifications");
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    readViewerTimeZone,
    readOfficeTimeZone,
  );

  const [items, setItems] = useState<Notification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [open, setOpen] = useState(false);
  // Ids already announced, so reopening the app does not toast the same warning twice.
  const announced = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch("/api/notifications").catch(() => null);
      if (cancelled) {
        return;
      }

      if (!response?.ok) {
        // The counter is left alone: a failed refresh is not evidence that the
        // warnings went away.
        setStatus("failed");
        return;
      }

      const body: { items: Notification[] } = await response.json();
      setItems(body.items);
      setStatus("ready");

      for (const item of body.items) {
        if (!announced.current.has(item.id)) {
          announced.current.add(item.id);
          showToast(t("endingSoon", { title: item.title }));
        }
      }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // t is stable for a given language; re-subscribing on it would restart the
    // polling on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);

    // Opening the panel is what counts as reading them.
    if (next && items.length > 0) {
      await fetch("/api/notifications", { method: "POST" }).catch(() => null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          items.length > 0 ? t("bellCount", { count: items.length }) : t("bellEmpty")
        }
        aria-expanded={open}
        className={`focus-ring text-text-secondary hover:text-text-primary rounded-control relative flex h-11 w-11 items-center justify-center transition sm:h-9 sm:w-9 ${
          open ? "bg-surface-muted" : ""
        }`}
      >
        {/* A drawn bell rather than 🔔: the emoji is coloured by the system font
            and would survive the grayscale check as the only spot of colour. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 6-3 7-3 7h18s-3-1-3-7" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {items.length > 0 ? (
          // The 2px border is the surface colour, so the counter stays readable
          // whatever it happens to sit on.
          <span className="bg-danger border-surface absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 px-1 font-mono text-[10px] leading-none font-semibold text-white sm:top-0.5 sm:right-0.5">
            {items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-border-grid bg-surface rounded-card shadow-modal animate-rise absolute right-0 z-40 mt-1 w-80 overflow-hidden border">
          <p className="border-border-grid border-b px-4 py-3 text-[13px] font-semibold">
            {t("title")}
          </p>

          {status === "loading" ? (
            <div aria-hidden className="flex flex-col gap-3 px-4 py-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" style={{ animationDelay: "120ms" }} />
            </div>
          ) : status === "failed" ? (
            <p className="text-text-secondary px-4 py-3 text-[13px] leading-relaxed">
              {t("refreshFailed")}
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col gap-1 px-4 py-6 text-center">
              <p className="text-sm font-semibold">{t("empty")}</p>
              <p className="text-text-tertiary text-[13px] leading-relaxed">
                {t("emptyHint")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="border-border-grid-half bg-accent-own-surface flex gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <span className="bg-accent-own-booking mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] leading-snug">
                      {t("item", { title: item.title, room: item.roomName })}
                    </span>
                    <span className="text-text-tertiary font-mono text-[11px]">
                      {DateTime.fromISO(item.endsAt).setZone(timeZone).toFormat("HH:mm")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
