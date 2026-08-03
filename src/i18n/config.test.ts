import { describe, expect, it } from "vitest";

import { preferredLocale } from "./config";

describe("preferredLocale", () => {
  it("reads the primary subtag of a regional tag", () => {
    expect(preferredLocale("uk-UA,uk;q=0.9")).toBe("uk");
    expect(preferredLocale("en-US,en;q=0.9")).toBe("en");
  });

  // The reason this is parsed rather than searched: "en-UK" contains "uk", and
  // a substring match answered Ukrainian to a browser asking for English.
  it("does not mistake a region for a language", () => {
    expect(preferredLocale("en-UK,en;q=0.9")).toBe("en");
  });

  it("follows the order the browser asked in, not the order of LOCALES", () => {
    expect(preferredLocale("en,uk;q=0.8")).toBe("en");
    expect(preferredLocale("uk,en;q=0.8")).toBe("uk");
  });

  it("skips languages the app does not have", () => {
    expect(preferredLocale("de-DE,de;q=0.9,en;q=0.7")).toBe("en");
  });

  it("falls back to the office language", () => {
    expect(preferredLocale("")).toBe("uk");
    expect(preferredLocale("de-DE,fr;q=0.7")).toBe("uk");
  });
});
