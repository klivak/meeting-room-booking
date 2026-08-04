"use client";

import { Bell, BellRing } from "lucide-react";
import { DateTime } from "luxon";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { showToast } from "@/components/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { SlotMotif } from "@/components/ui/SlotMotif";
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

  /**
   * Marks everything read. An explicit button rather than a side effect of
   * opening the panel: a warning that disappears because it was glanced at is
   * one the user cannot come back to.
   */
  async function readAll() {
    setItems([]);
    await fetch("/api/notifications", { method: "POST" }).catch(() => null);
  }

  const count = items.length;

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={count > 0 ? t("bellCount", { count }) : t("bellEmpty")}
        aria-expanded={open}
        className={`focus-ring border-border-grid text-text-secondary hover:text-text-primary hover:border-border-control rounded-chip relative flex h-11 w-11 shrink-0 items-center justify-center border transition sm:h-9 sm:w-9 ${
          open ? "bg-surface-raised text-text-primary" : "bg-surface-muted"
        }`}
      >
        {/* The ringing bell once something is waiting, the still one otherwise:
            the shape says "new" before the counter is read. */}
        {count > 0 ? (
          <BellRing aria-hidden="true" className="size-[17px]" />
        ) : (
          <Bell aria-hidden="true" className="size-[17px]" />
        )}
        {count > 0 ? (
          // The 2px ring is the header colour, so the counter stays legible
          // whatever it sits on. It arrives with a beat, so a warning that
          // appears while the page is open gets noticed without the grid moving.
          <span className="bg-now-label border-surface animate-badge absolute -top-1.5 -right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 px-1 font-mono text-[10px] leading-none font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-glass-edge bg-glass rounded-card shadow-panel animate-panel absolute right-0 z-40 mt-1.5 w-80 overflow-hidden border backdrop-blur-xl">
          <div className="border-border-grid flex items-center justify-between border-b px-4 py-3.5">
            <span className="text-sm font-extrabold">{t("title")}</span>
            {count > 0 ? (
              <button
                type="button"
                onClick={readAll}
                className="focus-ring text-accent-own-ink rounded text-xs font-bold"
              >
                {t("readAll")}
              </button>
            ) : null}
          </div>

          {status === "loading" ? (
            <div aria-hidden className="flex flex-col gap-3 px-4 py-4">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" style={{ animationDelay: "120ms" }} />
            </div>
          ) : status === "failed" ? (
            <p className="text-text-secondary px-4 py-4 text-[13px] leading-relaxed">
              {t("refreshFailed")}
            </p>
          ) : count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
              <SlotMotif small className="mb-1" />
              <p className="text-sm font-bold">{t("empty")}</p>
              <p className="text-text-tertiary text-[13px] leading-relaxed">
                {t("emptyHint")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="border-border-grid bg-warning-surface flex gap-[11px] border-b px-4 py-3.5 last:border-b-0"
                >
                  <span className="bg-now-line mt-[5px] size-2 shrink-0 rounded-full shadow-[0_0_0_3px_var(--color-warning-surface)]" />
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-[13px] leading-snug font-semibold">
                      {t("item", { title: item.title, room: item.roomName })}
                    </span>
                    <span className="text-text-tertiary font-mono text-xs">
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
