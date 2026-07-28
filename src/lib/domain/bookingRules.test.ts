import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { validateBookingTime, validateTitle } from "./bookingRules";
import { OFFICE_TZ } from "./constants";

/** Builds an instant from a wall-clock time in the office timezone. */
const kyiv = (iso: string) => DateTime.fromISO(iso, { zone: OFFICE_TZ }).toJSDate();

// Far enough in the past that nothing in these tests is accidentally "already started".
const NOW = kyiv("2026-01-01T00:00");

const codesFor = (startsAt: Date, endsAt: Date, now: Date = NOW) =>
  validateBookingTime({ startsAt, endsAt, now }).map((error) => error.code);

describe("working hours", () => {
  it("accepts a booking inside the office day", () => {
    expect(codesFor(kyiv("2026-03-10T09:00"), kyiv("2026-03-10T09:30"))).toEqual([]);
  });

  it("accepts a booking that ends exactly at closing time", () => {
    expect(codesFor(kyiv("2026-03-10T18:30"), kyiv("2026-03-10T19:00"))).toEqual([]);
  });

  it("rejects a booking that starts before opening time", () => {
    expect(codesFor(kyiv("2026-03-10T08:30"), kyiv("2026-03-10T09:30"))).toContain(
      "OUTSIDE_WORKING_HOURS",
    );
  });

  it("rejects a booking that runs past closing time", () => {
    expect(codesFor(kyiv("2026-03-10T18:45"), kyiv("2026-03-10T19:15"))).toContain(
      "OUTSIDE_WORKING_HOURS",
    );
  });

  it("rejects a booking that crosses midnight", () => {
    expect(codesFor(kyiv("2026-03-10T23:30"), kyiv("2026-03-11T00:30"))).toContain(
      "OUTSIDE_WORKING_HOURS",
    );
  });
});

// The trap this whole design exists for: "09:00 in Kyiv" is a different UTC hour
// in winter and in summer, so any hardcoded offset breaks on the switch week.
describe("daylight saving time in Europe/Kyiv", () => {
  it("accepts 09:00-09:30 both in winter and in summer", () => {
    expect(codesFor(kyiv("2026-02-10T09:00"), kyiv("2026-02-10T09:30"))).toEqual([]);
    expect(codesFor(kyiv("2026-07-10T09:00"), kyiv("2026-07-10T09:30"))).toEqual([]);
  });

  it("really is a different UTC hour on those two dates", () => {
    expect(kyiv("2026-02-10T09:00").toISOString()).toBe("2026-02-10T07:00:00.000Z");
    expect(kyiv("2026-07-10T09:00").toISOString()).toBe("2026-07-10T06:00:00.000Z");
  });

  it("still rejects 08:30 office time in summer, even though it is 05:30 UTC", () => {
    expect(codesFor(kyiv("2026-07-10T08:30"), kyiv("2026-07-10T09:30"))).toContain(
      "OUTSIDE_WORKING_HOURS",
    );
  });
});

describe("granularity", () => {
  it("rejects a start off the 30-minute grid", () => {
    expect(codesFor(kyiv("2026-03-10T10:15"), kyiv("2026-03-10T11:15"))).toContain(
      "TIME_NOT_ALIGNED",
    );
  });

  it("rejects stray seconds", () => {
    expect(codesFor(kyiv("2026-03-10T10:00:30"), kyiv("2026-03-10T11:00"))).toContain(
      "TIME_NOT_ALIGNED",
    );
  });

  it("accepts both half-hour marks", () => {
    expect(codesFor(kyiv("2026-03-10T10:30"), kyiv("2026-03-10T11:00"))).toEqual([]);
  });
});

describe("duration", () => {
  it("rejects anything shorter than 30 minutes", () => {
    expect(codesFor(kyiv("2026-03-10T10:00"), kyiv("2026-03-10T10:25"))).toContain(
      "DURATION_INVALID",
    );
  });

  it("accepts exactly 4 hours", () => {
    expect(codesFor(kyiv("2026-03-10T10:00"), kyiv("2026-03-10T14:00"))).toEqual([]);
  });

  it("rejects 4 hours and a half", () => {
    expect(codesFor(kyiv("2026-03-10T10:00"), kyiv("2026-03-10T14:30"))).toContain(
      "DURATION_INVALID",
    );
  });
});

describe("interval sanity", () => {
  it("rejects an end that is not after the start", () => {
    expect(codesFor(kyiv("2026-03-10T11:00"), kyiv("2026-03-10T10:00"))).toEqual([
      "VALIDATION_ERROR",
    ]);
    expect(codesFor(kyiv("2026-03-10T10:00"), kyiv("2026-03-10T10:00"))).toEqual([
      "VALIDATION_ERROR",
    ]);
  });
});

describe("future only", () => {
  it("rejects a booking that starts exactly now", () => {
    const start = kyiv("2026-03-10T10:00");

    expect(codesFor(start, kyiv("2026-03-10T11:00"), start)).toContain("TIME_IN_PAST");
  });

  it("accepts a booking that starts a minute later", () => {
    const now = kyiv("2026-03-10T09:59");

    expect(codesFor(kyiv("2026-03-10T10:00"), kyiv("2026-03-10T11:00"), now)).toEqual(
      [],
    );
  });

  it("reports every broken rule at once", () => {
    // Off-grid, too long and in the past.
    const codes = codesFor(
      kyiv("2026-03-10T10:15"),
      kyiv("2026-03-10T15:15"),
      kyiv("2026-03-11T10:00"),
    );

    expect(codes).toEqual(["TIME_NOT_ALIGNED", "DURATION_INVALID", "TIME_IN_PAST"]);
  });
});

describe("validateTitle", () => {
  it("accepts a normal title", () => {
    expect(validateTitle("Планерка")).toBeNull();
  });

  it("rejects a title made of spaces", () => {
    expect(validateTitle("   ")?.code).toBe("TITLE_INVALID");
  });

  it("counts length after trimming", () => {
    expect(validateTitle(`  ${"я".repeat(100)}  `)).toBeNull();
    expect(validateTitle("я".repeat(101))?.code).toBe("TITLE_INVALID");
  });
});
