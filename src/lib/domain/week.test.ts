import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { OFFICE_TZ } from "./constants";
import { generateSlots, getWeekStart } from "./week";

const kyiv = (iso: string) => DateTime.fromISO(iso, { zone: OFFICE_TZ });

describe("getWeekStart with Monday as the first day", () => {
  it("moves back to the Monday of the same week", () => {
    // 2026-03-11 is a Wednesday.
    expect(getWeekStart(kyiv("2026-03-11T15:20"), 1).toISO()).toBe(
      kyiv("2026-03-09T00:00").toISO(),
    );
  });

  it("keeps a Monday where it is, at midnight", () => {
    expect(getWeekStart(kyiv("2026-03-09T23:59"), 1).toISO()).toBe(
      kyiv("2026-03-09T00:00").toISO(),
    );
  });

  it("sends a Sunday back six days, not forward one", () => {
    expect(getWeekStart(kyiv("2026-03-15T10:00"), 1).toISO()).toBe(
      kyiv("2026-03-09T00:00").toISO(),
    );
  });
});

describe("getWeekStart with a configured first day", () => {
  it("supports Sunday as the first day", () => {
    expect(getWeekStart(kyiv("2026-03-11T10:00"), 7).toISO()).toBe(
      kyiv("2026-03-08T00:00").toISO(),
    );
  });
});

describe("getWeekStart around the DST switch", () => {
  // Kyiv moves to summer time on 2026-03-29, which is a Sunday.
  it("still lands on local midnight when the switch is inside the week", () => {
    const weekStart = getWeekStart(kyiv("2026-03-29T12:00"), 1);

    expect(weekStart.toISO()).toBe(kyiv("2026-03-23T00:00").toISO());
    expect(weekStart.hour).toBe(0);
  });

  it("works from the first day after the switch too", () => {
    const weekStart = getWeekStart(kyiv("2026-03-30T09:00"), 1);

    expect(weekStart.toISO()).toBe(kyiv("2026-03-30T00:00").toISO());
    expect(weekStart.hour).toBe(0);
  });
});

describe("getWeekStart keeps the zone it was given", () => {
  it("uses the local day of that zone, not UTC", () => {
    // 2026-03-09T00:30 in Kyiv is still 2026-03-08T22:30 in UTC.
    const weekStart = getWeekStart(kyiv("2026-03-09T00:30"), 1);

    expect(weekStart.zoneName).toBe(OFFICE_TZ);
    expect(weekStart.toISODate()).toBe("2026-03-09");
  });
});

describe("generateSlots", () => {
  const slots = generateSlots();

  it("covers the office day in 30-minute steps", () => {
    expect(slots[0]).toBe("09:00");
    expect(slots[1]).toBe("09:30");
    expect(slots.at(-1)).toBe("18:30");
    expect(slots).toHaveLength(20);
  });

  it("does not include the closing time, which is an end boundary only", () => {
    expect(slots).not.toContain("19:00");
  });
});
