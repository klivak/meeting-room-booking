import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  OFFICE_TZ,
  SLOT_MINUTES,
  WORK_DAY_END,
  WORK_DAY_START,
} from "./constants";

// Smoke test: proves the test runner is wired up.
// Real rule tests arrive together with the domain logic.
describe("domain constants", () => {
  it("describes a 09:00-19:00 office day in Kyiv time", () => {
    expect(OFFICE_TZ).toBe("Europe/Kyiv");
    expect(WORK_DAY_START).toBe("09:00");
    expect(WORK_DAY_END).toBe("19:00");
  });

  it("keeps durations aligned to the 30-minute grid", () => {
    expect(MIN_DURATION_MINUTES).toBe(SLOT_MINUTES);
    expect(MAX_DURATION_MINUTES % SLOT_MINUTES).toBe(0);
    expect(MAX_DURATION_MINUTES).toBeGreaterThan(MIN_DURATION_MINUTES);
  });
});
