import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { THEME_SCRIPT, THEME_SCRIPT_HASH } from "./themeScript";

describe("theme script", () => {
  // The hash is written down rather than computed at startup, so nothing but
  // this test stops the two drifting apart. If they do, the browser silently
  // refuses the script and every dark-theme visitor gets a white flash — a
  // failure that shows up as a screenshot nobody looks at twice.
  it("is the script the policy names", () => {
    const actual = `sha256-${createHash("sha256").update(THEME_SCRIPT, "utf8").digest("base64")}`;

    expect(THEME_SCRIPT_HASH).toBe(actual);
  });
});
