"use client";

import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { showToast } from "@/components/toast";
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
  const [open, setOpen] = useState(false);
  // Ids already announced, so reopening the app does not toast the same warning twice.
  const announced = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const response = await fetch("/api/notifications").catch(() => null);
      if (!response?.ok || cancelled) {
        return;
      }

      const body: { items: Notification[] } = await response.json();
      setItems(body.items);

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
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 sm:min-h-9 sm:min-w-9 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
      >
        <span aria-hidden="true">🔔</span>
        {items.length > 0 ? (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          {items.length === 0 ? (
            <p className="text-sm text-slate-600">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="text-sm text-slate-700">
                  {t("item", {
                    title: item.title,
                    time: DateTime.fromISO(item.endsAt)
                      .setZone(timeZone)
                      .toFormat("HH:mm"),
                    room: item.roomName,
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
