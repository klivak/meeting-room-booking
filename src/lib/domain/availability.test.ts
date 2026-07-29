import { describe, expect, it } from "vitest";

import { getRoomAvailability } from "./availability";

// Times are written in UTC: the question is about intervals, and the caller is
// the one that turns an office day into two instants.
const at = (iso: string) => new Date(`2026-03-10T${iso}:00.000Z`);

const DAY_START = at("09:00");
const DAY_END = at("19:00");

const availability = (
  bookings: [string, string][],
  now: string,
) =>
  getRoomAvailability(
    bookings.map(([startsAt, endsAt]) => ({ startsAt: at(startsAt), endsAt: at(endsAt) })),
    at(now),
    DAY_START,
    DAY_END,
  );

describe("getRoomAvailability", () => {
  it("calls an unbooked room free", () => {
    expect(availability([], "11:00")).toEqual({ kind: "free" });
  });

  it("calls a room free when the next booking is still ahead", () => {
    expect(availability([["15:00", "16:00"]], "11:00")).toEqual({ kind: "free" });
  });

  it("reports when a busy room frees up", () => {
    expect(availability([["10:30", "12:00"]], "11:00")).toEqual({
      kind: "freeFrom",
      at: at("12:00"),
    });
  });

  it("skips over back-to-back bookings", () => {
    expect(
      availability(
        [
          ["10:30", "12:00"],
          ["12:00", "13:30"],
        ],
        "11:00",
      ),
    ).toEqual({ kind: "freeFrom", at: at("13:30") });
  });

  it("stays free when a booking ends exactly now", () => {
    expect(availability([["10:00", "11:00"]], "11:00")).toEqual({ kind: "free" });
  });

  it("waits for the office to open", () => {
    expect(availability([], "07:00")).toEqual({ kind: "freeFrom", at: DAY_START });
  });

  it("reports a day booked solid", () => {
    expect(availability([["09:00", "19:00"]], "11:00")).toEqual({ kind: "busyToday" });
  });

  it("does not offer a gap shorter than one slot", () => {
    expect(availability([["09:00", "18:45"]], "11:00")).toEqual({ kind: "busyToday" });
  });

  it("reports the office day as over", () => {
    expect(availability([], "19:00")).toEqual({ kind: "closed" });
  });
});
