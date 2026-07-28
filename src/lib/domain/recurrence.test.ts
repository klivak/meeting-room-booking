import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { validateBookingTime } from "./bookingRules";
import { OFFICE_TZ } from "./constants";
import { getWeeklyOccurrences } from "./recurrence";

const kyiv = (iso: string) => DateTime.fromISO(iso, { zone: OFFICE_TZ });
const at = (iso: string) => kyiv(iso).toJSDate();

const officeTimes = (occurrences: { startsAt: Date }[]) =>
  occurrences.map((occurrence) =>
    DateTime.fromJSDate(occurrence.startsAt).setZone(OFFICE_TZ).toFormat("yyyy-LL-dd HH:mm"),
  );

describe("getWeeklyOccurrences", () => {
  it("includes the first booking and repeats it weekly", () => {
    const occurrences = getWeeklyOccurrences(
      at("2026-08-24T10:00"),
      at("2026-08-24T11:00"),
      3,
    );

    expect(officeTimes(occurrences)).toEqual([
      "2026-08-24 10:00",
      "2026-08-31 10:00",
      "2026-09-07 10:00",
    ]);
  });

  it("keeps the duration of every occurrence", () => {
    const occurrences = getWeeklyOccurrences(
      at("2026-08-24T10:00"),
      at("2026-08-24T11:30"),
      4,
    );

    for (const occurrence of occurrences) {
      expect(occurrence.endsAt.getTime() - occurrence.startsAt.getTime()).toBe(
        90 * 60 * 1000,
      );
    }
  });

  it("keeps office wall-clock time across the switch to summer time", () => {
    // Kyiv moves to summer time on 2026-03-29, between these two occurrences.
    const occurrences = getWeeklyOccurrences(
      at("2026-03-25T10:00"),
      at("2026-03-25T11:00"),
      2,
    );

    expect(officeTimes(occurrences)).toEqual(["2026-03-25 10:00", "2026-04-01 10:00"]);
    // The same wall clock is a different UTC hour, which is the whole point.
    expect(occurrences[0].startsAt.toISOString()).toBe("2026-03-25T08:00:00.000Z");
    expect(occurrences[1].startsAt.toISOString()).toBe("2026-04-01T07:00:00.000Z");
  });

  it("produces occurrences that all pass the booking rules", () => {
    const occurrences = getWeeklyOccurrences(
      at("2026-03-25T10:00"),
      at("2026-03-25T11:00"),
      6,
    );

    for (const occurrence of occurrences) {
      expect(
        validateBookingTime({ ...occurrence, now: at("2026-03-01T00:00") }),
      ).toEqual([]);
    }
  });

  it("returns a single booking when asked for one", () => {
    expect(getWeeklyOccurrences(at("2026-08-24T10:00"), at("2026-08-24T11:00"), 1)).toHaveLength(1);
  });
});
