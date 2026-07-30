"use client";

import { Bell, BellRing } from "lucide-react";
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
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // A dropdown has to close the two ways every dropdown closes: a press outside
  // it and Escape. The same arrangement as the header menu.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        // The panel is gone, so the focus goes back to the bell that opened it
        // rather than being left on the document.
        trigger.current?.focus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-label={
          items.length > 0 ? t("bellCount", { count: items.length }) : t("bellEmpty")
        }
        aria-expanded={open}
        className={`focus-ring border-border-grid text-text-secondary hover:text-text-primary rounded-control relative flex h-11 w-11 shrink-0 items-center justify-center border transition sm:h-9 sm:w-9 ${
          open ? "bg-surface-muted text-text-primary" : "bg-surface"
        }`}
      >
        {/* The ringing bell once something is waiting, the still one otherwise:
            the shape says "new" before the counter is read. */}
        {items.length > 0 ? (
          <BellRing aria-hidden="true" className="size-[18px]" />
        ) : (
          <Bell aria-hidden="true" className="size-[18px]" />
        )}
        {items.length > 0 ? (
          // The 2px border is the surface colour, so the counter stays readable
          // whatever it happens to sit on.
          <span className="bg-now-line border-surface absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 px-1 font-mono text-[10px] leading-none font-semibold text-white sm:-top-1 sm:-right-1">
            {items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-border-grid bg-surface rounded-card shadow-modal animate-panel absolute right-0 z-40 mt-1 w-80 overflow-hidden border">
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
