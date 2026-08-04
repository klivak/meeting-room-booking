import { describe, expect, it } from "vitest";

import { createBookingSchema, messageKeyFor } from "./bookingInput";

describe("messageKeyFor", () => {
  it("keeps a message written as a dictionary key", () => {
    expect(messageKeyFor({ message: "TIME_INVALID" })).toBe("TIME_INVALID");
    expect(messageKeyFor({ message: "REPEAT_TOO_FEW" })).toBe("REPEAT_TOO_FEW");
  });

  // The whole point: a schema that forgot its key must not put Zod's English
  // into a response the user reads.
  it("replaces anything that is not a key with the generic one", () => {
    expect(messageKeyFor({ message: "Invalid ISO datetime" })).toBe(
      "VALIDATION_ERROR",
    );
    expect(messageKeyFor({ message: "Required" })).toBe("VALIDATION_ERROR");
    expect(messageKeyFor({ message: "" })).toBe("VALIDATION_ERROR");
  });

  it("passes every message the booking schema can produce", () => {
    const result = createBookingSchema.safeParse({
      roomId: "",
      title: "",
      startsAt: "not-a-date",
      endsAt: "not-a-date",
      repeatWeeks: "many",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    // Every issue keeps its own key, so none of them falls back to the generic
    // message — that fallback exists for schemas nobody has written yet.
    for (const issue of result.error.issues) {
      expect(messageKeyFor(issue)).toBe(issue.message);
    }
  });
});
