import { z } from "zod";

import { MAX_OCCURRENCES, MIN_OCCURRENCES } from "./recurrence";

// Shape of the booking payload, shared by the API routes and the form. The
// timestamps arrive as ISO strings; an explicit offset is accepted because it
// still names exactly one instant, which is all the server stores.

// Every message here is a key of the api dictionary, never a sentence:
// validationError feeds issue.message straight into t(). A schema left with
// Zod's own wording would put English into a response meant to be shown to the
// user as it is.
const isoInstant = z.iso.datetime({ offset: true, message: "TIME_INVALID" });

export const createBookingSchema = z.object({
  roomId: z.string().min(1, "ROOM_REQUIRED"),
  // Length and emptiness are checked by validateTitle, so the code stays TITLE_INVALID.
  title: z.string(),
  startsAt: isoInstant,
  endsAt: isoInstant,
  // Total number of weekly occurrences, the first one included. Absent means a
  // single booking.
  repeatWeeks: z.coerce
    .number("REPEAT_INVALID")
    .int("REPEAT_INVALID")
    .min(MIN_OCCURRENCES, "REPEAT_TOO_FEW")
    .max(MAX_OCCURRENCES, "REPEAT_TOO_MANY")
    .optional(),
});

// Editing may touch any subset of the fields; whatever is omitted keeps its
// current value and is still re-validated together with the rest.
export const updateBookingSchema = z.object({
  roomId: z.string().min(1, "ROOM_REQUIRED").optional(),
  title: z.string().optional(),
  startsAt: isoInstant.optional(),
  endsAt: isoInstant.optional(),
});

/**
 * Dictionary key for a failed schema check.
 *
 * Keys are written in SCREAMING_SNAKE_CASE by convention; anything else is
 * Zod's own English sentence, which a schema that forgot its key would leave
 * behind. Both readers of these schemas — the API route and the form — ask
 * here, so neither can hand that sentence to the user as if it were the wording.
 */
export function messageKeyFor(issue: { message: string }): string {
  return /^[A-Z][A-Z0-9_]*$/.test(issue.message) ? issue.message : "VALIDATION_ERROR";
}
