import { describe, expect, it } from "vitest";

import { isEndingNotificationDue } from "./notifications";

const at = (iso: string) => new Date(`2026-08-24T${iso}:00.000Z`);

const candidate = (overrides: Partial<Parameters<typeof isEndingNotificationDue>[0]> = {}) => ({
  booking: { endsAt: at("11:00"), canceledAt: null },
  nextBooking: { startsAt: at("11:00"), canceledAt: null },
  now: at("10:50"),
  minutesBefore: 10,
  ...overrides,
});

describe("isEndingNotificationDue", () => {
  it("warns exactly at the configured distance from the end", () => {
    expect(isEndingNotificationDue(candidate())).toBe(true);
  });

  it("stays quiet a minute too early", () => {
    expect(isEndingNotificationDue(candidate({ now: at("10:49") }))).toBe(false);
  });

  it("stays quiet once the booking has ended", () => {
    expect(isEndingNotificationDue(candidate({ now: at("11:00") }))).toBe(false);
  });

  it("says nothing when the next slot is free", () => {
    expect(isEndingNotificationDue(candidate({ nextBooking: null }))).toBe(false);
  });

  it("says nothing when the next booking only starts later", () => {
    expect(
      isEndingNotificationDue(
        candidate({ nextBooking: { startsAt: at("11:30"), canceledAt: null } }),
      ),
    ).toBe(false);
  });

  it("says nothing when the next booking was canceled", () => {
    expect(
      isEndingNotificationDue(
        candidate({ nextBooking: { startsAt: at("11:00"), canceledAt: at("10:00") } }),
      ),
    ).toBe(false);
  });

  it("says nothing when this booking was canceled", () => {
    expect(
      isEndingNotificationDue(
        candidate({ booking: { endsAt: at("11:00"), canceledAt: at("10:00") } }),
      ),
    ).toBe(false);
  });

  it("respects a different configured distance", () => {
    const thirtyMinutes = candidate({ minutesBefore: 30, now: at("10:31") });

    expect(isEndingNotificationDue(thirtyMinutes)).toBe(true);
    expect(isEndingNotificationDue({ ...thirtyMinutes, now: at("10:29") })).toBe(false);
  });
});
