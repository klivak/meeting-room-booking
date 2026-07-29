import { describe, expect, it } from "vitest";

import { showsSameClock } from "./timezone";

// Summer, so Kyiv is on daylight time and the offsets below are the summer ones.
const SUMMER = new Date("2026-07-29T12:00:00.000Z");

describe("showsSameClock", () => {
  it("accepts the old alias for the office zone", () => {
    // This is the case that matters: a browser in Kyiv reports "Europe/Kiev",
    // and warning that user about their timezone would be nonsense.
    expect(showsSameClock("Europe/Kiev", "Europe/Kyiv", SUMMER)).toBe(true);
  });

  it("accepts a different zone on the same offset", () => {
    // The labels on the grid really are office times there.
    expect(showsSameClock("Europe/Bucharest", "Europe/Kyiv", SUMMER)).toBe(true);
  });

  it("rejects a zone an hour away", () => {
    expect(showsSameClock("Europe/Berlin", "Europe/Kyiv", SUMMER)).toBe(false);
  });

  it("rejects a zone across midnight", () => {
    expect(showsSameClock("Asia/Tokyo", "Europe/Kyiv", SUMMER)).toBe(false);
  });

  it("rejects a name it does not recognise", () => {
    expect(showsSameClock("Nowhere/Nothing", "Europe/Kyiv", SUMMER)).toBe(false);
  });
});
