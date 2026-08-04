"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

// Horizontal distance that separates a swipe from a stray finger movement.
const SWIPE_THRESHOLD_PX = 60;

type SwipeAreaProps = {
  prevHref: string;
  nextHref: string;
  children: React.ReactNode;
};

/**
 * Turns a horizontal swipe into the same navigation the arrows perform. It is
 * an addition, not a replacement: the arrows stay for anyone using a keyboard,
 * a mouse or a screen reader.
 */
export function SwipeArea({ prevHref, nextHref, children }: SwipeAreaProps) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      onTouchStart={(event) => {
        const touch = event.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        if (!start.current) {
          return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - start.current.x;
        const deltaY = touch.clientY - start.current.y;
        start.current = null;

        // A mostly vertical movement is the user scrolling the grid, not swiping.
        if (
          Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
          Math.abs(deltaY) > Math.abs(deltaX)
        ) {
          return;
        }

        router.push(deltaX < 0 ? nextHref : prevHref);
      }}
    >
      {children}
    </div>
  );
}
