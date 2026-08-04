import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { validateBookingTime } from "./bookingRules";
import { OFFICE_TZ } from "./constants";
import {
  SLOT_COUNT,
  splitDuration,
  getEndSlotBounds,
  getNowMarker,
  getSelectionRows,
  getSlotIndex,
  getSlotLabel,
  getSlotLabels,
  getSlotStart,
  getWeekDays,
  placeBooking,
} from "./grid";

const kyiv = (iso: string) => DateTime.fromISO(iso, { zone: OFFICE_TZ });
const at = (iso: string) => kyiv(iso).toJSDate();

// Monday of a plain summer week.
const WEEK_START = kyiv("2026-08-24T00:00");

/**
 * Runs a pair of slot indexes through the real booking rules, so the options the
 * form offers are checked against the validation the server actually applies.
 * "Future only" is left out: these dates are fixed in the past of the test.
 */
const codesForRange = (day: DateTime, startIndex: number, endIndex: number) =>
  validateBookingTime({
    startsAt: getSlotStart(day, startIndex).toJSDate(),
    endsAt: getSlotStart(day, endIndex).toJSDate(),
    now: kyiv("2020-01-01T00:00").toJSDate(),
  })
    .map((error) => error.code)
    .filter((code) => code !== "TIME_IN_PAST");

describe("grid shape", () => {
  it("covers the office day in 30-minute rows", () => {
    expect(SLOT_COUNT).toBe(20);
  });

  it("lists seven office days starting from the given day", () => {
    const days = getWeekDays(WEEK_START);

    expect(days).toHaveLength(7);
    expect(days[0].toISODate()).toBe("2026-08-24");
    expect(days[6].toISODate()).toBe("2026-08-30");
    expect(days.every((day) => day.hour === 0)).toBe(true);
  });
});

describe("placeBooking", () => {
  it("puts the first slot of Monday at the top left", () => {
    expect(
      placeBooking(
        { startsAt: at("2026-08-24T09:00"), endsAt: at("2026-08-24T09:30") },
        WEEK_START,
      ),
    ).toEqual({ dayIndex: 0, rowStart: 0, rowSpan: 1 });
  });

  it("spans several rows for a longer booking", () => {
    expect(
      placeBooking(
        { startsAt: at("2026-08-26T10:00"), endsAt: at("2026-08-26T12:00") },
        WEEK_START,
      ),
    ).toEqual({ dayIndex: 2, rowStart: 2, rowSpan: 4 });
  });

  it("places the last slot of the day at the bottom", () => {
    expect(
      placeBooking(
        { startsAt: at("2026-08-30T18:30"), endsAt: at("2026-08-30T19:00") },
        WEEK_START,
      ),
    ).toEqual({ dayIndex: 6, rowStart: 19, rowSpan: 1 });
  });

  it("ignores bookings from other weeks", () => {
    expect(
      placeBooking(
        { startsAt: at("2026-08-23T10:00"), endsAt: at("2026-08-23T11:00") },
        WEEK_START,
      ),
    ).toBeNull();
    expect(
      placeBooking(
        { startsAt: at("2026-08-31T10:00"), endsAt: at("2026-08-31T11:00") },
        WEEK_START,
      ),
    ).toBeNull();
  });

  it("keeps back-to-back bookings in adjacent, non-overlapping rows", () => {
    const first = placeBooking(
      { startsAt: at("2026-08-24T10:00"), endsAt: at("2026-08-24T11:00") },
      WEEK_START,
    );
    const second = placeBooking(
      { startsAt: at("2026-08-24T11:00"), endsAt: at("2026-08-24T11:30") },
      WEEK_START,
    );

    expect(first).toEqual({ dayIndex: 0, rowStart: 2, rowSpan: 2 });
    expect(second?.rowStart).toBe(first!.rowStart + first!.rowSpan);
  });

  it("uses the office date, not the viewer's, to pick the column", () => {
    // 18:30 Kyiv on Friday is already Saturday 01:30 in Tokyo, but the booking
    // still belongs to the office Friday.
    const placement = placeBooking(
      { startsAt: at("2026-08-28T18:30"), endsAt: at("2026-08-28T19:00") },
      WEEK_START,
    );

    expect(placement?.dayIndex).toBe(4);
  });
});

describe("placeBooking across the DST switch", () => {
  // Kyiv moves to summer time on Sunday 2026-03-29.
  const dstWeek = kyiv("2026-03-23T00:00");

  it("puts 09:00 office time in the first row on both sides of the switch", () => {
    const before = placeBooking(
      { startsAt: at("2026-03-27T09:00"), endsAt: at("2026-03-27T10:00") },
      dstWeek,
    );
    const after = placeBooking(
      { startsAt: at("2026-03-30T09:00"), endsAt: at("2026-03-30T10:00") },
      kyiv("2026-03-30T00:00"),
    );

    expect(before?.rowStart).toBe(0);
    expect(after?.rowStart).toBe(0);
  });

  it("really is a different UTC hour on those two days", () => {
    expect(at("2026-03-27T09:00").toISOString()).toBe(
      "2026-03-27T07:00:00.000Z",
    );
    expect(at("2026-03-30T09:00").toISOString()).toBe(
      "2026-03-30T06:00:00.000Z",
    );
  });
});

describe("getSlotStart", () => {
  it("turns a row into the instant the cell stands for", () => {
    expect(getSlotStart(kyiv("2026-08-24T00:00"), 0).toISO()).toBe(
      kyiv("2026-08-24T09:00").toISO(),
    );
    expect(getSlotStart(kyiv("2026-08-24T00:00"), 3).toISO()).toBe(
      kyiv("2026-08-24T10:30").toISO(),
    );
    expect(getSlotStart(kyiv("2026-08-24T00:00"), SLOT_COUNT - 1).toISO()).toBe(
      kyiv("2026-08-24T18:30").toISO(),
    );
  });

  it("round-trips with placeBooking", () => {
    const start = getSlotStart(kyiv("2026-08-26T00:00"), 5);
    const placement = placeBooking(
      {
        startsAt: start.toJSDate(),
        endsAt: start.plus({ minutes: 30 }).toJSDate(),
      },
      WEEK_START,
    );

    expect(placement).toEqual({ dayIndex: 2, rowStart: 5, rowSpan: 1 });
  });
});

describe("getSlotLabels", () => {
  it("shows office time for a viewer in Kyiv", () => {
    const labels = getSlotLabels(WEEK_START, OFFICE_TZ);

    expect(labels[0]).toBe("09:00");
    expect(labels[1]).toBe("09:30");
    expect(labels.at(-1)).toBe("18:30");
    expect(labels).toHaveLength(20);
  });

  it("shifts the office day by an hour for a viewer in Berlin", () => {
    const labels = getSlotLabels(WEEK_START, "Europe/Berlin");

    expect(labels[0]).toBe("08:00");
    expect(labels.at(-1)).toBe("17:30");
  });

  it("wraps past midnight for a viewer in Tokyo without breaking the row count", () => {
    const labels = getSlotLabels(WEEK_START, "Asia/Tokyo");

    expect(labels[0]).toBe("15:00");
    expect(labels.at(-1)).toBe("00:30");
    expect(labels).toHaveLength(20);
  });

  it("is computed per day, so a one-sided DST switch shifts only the days after it", () => {
    // Kyiv switches on 2026-03-29, Tokyo never does.
    const beforeSwitch = getSlotLabels(kyiv("2026-03-27T00:00"), "Asia/Tokyo");
    const afterSwitch = getSlotLabels(kyiv("2026-03-30T00:00"), "Asia/Tokyo");

    expect(beforeSwitch[0]).toBe("16:00");
    expect(afterSwitch[0]).toBe("15:00");
  });
});

describe("getSlotIndex", () => {
  it("is the inverse of getSlotStart", () => {
    const day = kyiv("2026-08-24T00:00");

    for (const index of [0, 1, 7, SLOT_COUNT - 1, SLOT_COUNT]) {
      expect(getSlotIndex(getSlotStart(day, index).toJSDate())).toBe(index);
    }
  });

  it("works the same on both sides of a DST switch", () => {
    expect(getSlotIndex(at("2026-03-27T10:00"))).toBe(2);
    expect(getSlotIndex(at("2026-03-30T10:00"))).toBe(2);
  });
});

describe("getSlotLabel", () => {
  it("labels opening and closing time in the viewer's zone", () => {
    const day = kyiv("2026-08-24T00:00");

    expect(getSlotLabel(day, 0, OFFICE_TZ)).toBe("09:00");
    expect(getSlotLabel(day, SLOT_COUNT, OFFICE_TZ)).toBe("19:00");
    expect(getSlotLabel(day, 0, "Europe/Berlin")).toBe("08:00");
    expect(getSlotLabel(day, SLOT_COUNT, "Europe/Berlin")).toBe("18:00");
  });
});

describe("getEndSlotBounds", () => {
  it("offers from 30 minutes up to 4 hours after the start", () => {
    expect(getEndSlotBounds(0)).toEqual({ min: 1, max: 8 });
  });

  it("never offers an end past closing time", () => {
    expect(getEndSlotBounds(SLOT_COUNT - 1)).toEqual({ min: 20, max: 20 });
    expect(getEndSlotBounds(SLOT_COUNT - 4)).toEqual({ min: 17, max: 20 });
  });

  it("agrees with the duration rule at both edges", () => {
    const day = kyiv("2026-08-24T00:00");
    const { min, max } = getEndSlotBounds(4);

    const shortest = codesForRange(day, 4, min);
    const longest = codesForRange(day, 4, max);
    const tooShort = codesForRange(day, 4, min - 1);
    const tooLong = codesForRange(day, 4, max + 1);

    expect(shortest).toEqual([]);
    expect(longest).toEqual([]);
    expect(tooShort).toContain("END_BEFORE_START");
    expect(tooLong).toContain("DURATION_INVALID");
  });
});

describe("getSelectionRows", () => {
  it("covers a single row when the drag never leaves the cell", () => {
    expect(getSelectionRows(4, 4)).toEqual({ rowStart: 4, rowEnd: 5 });
  });

  it("covers everything between the two cells", () => {
    expect(getSelectionRows(4, 7)).toEqual({ rowStart: 4, rowEnd: 8 });
  });

  it("works the same when dragged upwards", () => {
    expect(getSelectionRows(7, 4)).toEqual({ rowStart: 4, rowEnd: 8 });
  });

  it("stops at the maximum duration instead of offering a refusal", () => {
    // Four hours is eight rows, however far the drag goes.
    expect(getSelectionRows(0, 19)).toEqual({ rowStart: 0, rowEnd: 8 });
  });

  it("never runs past closing time", () => {
    expect(getSelectionRows(18, 19)).toEqual({ rowStart: 18, rowEnd: 20 });
  });

  it("produces a range the booking rules accept", () => {
    const day = kyiv("2026-08-24T00:00");
    const { rowStart, rowEnd } = getSelectionRows(2, 19);

    expect(codesForRange(day, rowStart, rowEnd)).toEqual([]);
  });
});

describe("splitDuration", () => {
  it("splits minutes into hours and minutes, leaving the words to the dictionary", () => {
    expect(splitDuration(30)).toEqual({ hours: 0, minutes: 30 });
    expect(splitDuration(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitDuration(240)).toEqual({ hours: 4, minutes: 0 });
  });
});

describe("getNowMarker", () => {
  it("locates the current moment inside the office day", () => {
    expect(getNowMarker(at("2026-08-26T14:00"), WEEK_START)).toEqual({
      dayIndex: 2,
      ratio: 0.5,
    });
  });

  it("sits at the very top at opening time and at the bottom at closing time", () => {
    expect(getNowMarker(at("2026-08-24T09:00"), WEEK_START)?.ratio).toBe(0);
    expect(getNowMarker(at("2026-08-24T19:00"), WEEK_START)?.ratio).toBe(1);
  });

  it("is hidden outside working hours and outside the week", () => {
    expect(getNowMarker(at("2026-08-24T08:59"), WEEK_START)).toBeNull();
    expect(getNowMarker(at("2026-08-24T19:01"), WEEK_START)).toBeNull();
    expect(getNowMarker(at("2026-09-01T12:00"), WEEK_START)).toBeNull();
  });
});
