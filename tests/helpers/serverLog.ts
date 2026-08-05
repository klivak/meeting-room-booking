import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// The confirmation link is not stored anywhere a test could read: the token in
// the table is a hash of it, and the link itself only ever goes to the server
// log. So the tests read it from the log, which is the same thing a test
// against a real mailer does — it opens what was sent, not what was saved.
//
// The setup writes the server output here; the path is shared rather than
// passed, because globalSetup and the test workers are separate processes.
export const SERVER_LOG_PATH = join(tmpdir(), "meeting-room-booking-test.log");

/**
 * The most recent confirmation link printed by the server.
 *
 * Last rather than first: a test that asks for a new link needs the new one,
 * and the files run one at a time, so "most recent" is unambiguous.
 */
export function lastVerificationLink(): string {
  const matches = readFileSync(SERVER_LOG_PATH, "utf8").match(
    /http:\/\/\S+\/api\/auth\/verify\?token=\S+/g,
  );

  if (!matches || matches.length === 0) {
    throw new Error("No verification link has been printed by the server yet");
  }

  return matches[matches.length - 1];
}
