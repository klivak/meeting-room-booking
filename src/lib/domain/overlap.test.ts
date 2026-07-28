import { describe, expect, it } from "vitest";

import { intervalsOverlap } from "./overlap";

// Times are written in UTC on purpose: overlap is a pure interval question and
// must not depend on any timezone.
const at = (iso: string) => new Date(`2026-03-10T${iso}:00.000Z`);

/** Checks the pair in both directions, since the rule has to be symmetric. */
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const forward = intervalsOverlap(at(aStart), at(aEnd), at(bStart), at(bEnd));
  const backward = intervalsOverlap(at(bStart), at(bEnd), at(aStart), at(aEnd));

  expect(forward).toBe(backward);
  return forward;
};

describe("intervalsOverlap", () => {
  it("treats back-to-back bookings as free", () => {
    expect(overlaps("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });

  it("detects partial overlap", () => {
    expect(overlaps("10:00", "11:00", "10:30", "11:30")).toBe(true);
  });

  it("detects an exact match", () => {
    expect(overlaps("10:00", "11:00", "10:00", "11:00")).toBe(true);
  });

  it("detects containment in both directions", () => {
    expect(overlaps("10:00", "12:00", "10:30", "11:00")).toBe(true);
  });

  it("leaves a gap on the same day free", () => {
    expect(overlaps("10:00", "11:00", "14:00", "15:00")).toBe(false);
  });

  it("does not clash across neighbouring days", () => {
    const mondayStart = new Date("2026-03-09T10:00:00.000Z");
    const mondayEnd = new Date("2026-03-09T11:00:00.000Z");
    const tuesdayStart = new Date("2026-03-10T10:00:00.000Z");
    const tuesdayEnd = new Date("2026-03-10T11:00:00.000Z");

    expect(
      intervalsOverlap(mondayStart, mondayEnd, tuesdayStart, tuesdayEnd),
    ).toBe(false);
  });

  it("clashes when one booking touches the other by a single minute", () => {
    expect(overlaps("10:00", "11:00", "10:59", "11:59")).toBe(true);
  });
});
