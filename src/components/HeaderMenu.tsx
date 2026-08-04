"use client";

import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The header controls in a dropdown, for screens too narrow to hold them in a
 * row. Its contents are passed in as children so they stay server-rendered —
 * the language switcher is a form with a server action and has to keep working
 * without client-side JavaScript once opened.
 */
export function HeaderMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

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
        // The menu is gone, so the focus has to land somewhere deliberate
        // rather than on the document.
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

  return (
    <div ref={container} className="relative sm:hidden">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`focus-ring border-border-grid text-text-secondary hover:text-text-primary rounded-chip flex h-11 w-11 items-center justify-center border transition ${
          open ? "bg-surface-raised" : "bg-surface-muted"
        }`}
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {open ? (
        <div
          // A link navigates away, so the menu closes behind it. The theme and
          // language switches stay open on purpose: both are worth pressing
          // twice in a row to compare.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              setOpen(false);
            }
          }}
          className="border-glass-edge bg-glass rounded-card shadow-panel animate-panel absolute top-full right-0 z-40 mt-1.5 flex w-[min(16rem,calc(100vw-2rem))] flex-col gap-2 border p-2.5 backdrop-blur-xl"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
