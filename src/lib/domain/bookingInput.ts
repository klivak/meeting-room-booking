import { z } from "zod";

import { MAX_OCCURRENCES, MIN_OCCURRENCES } from "./recurrence";

// Shape of the booking payload, shared by the API routes and the form. The
// timestamps arrive as ISO strings; an explicit offset is accepted because it
// still names exactly one instant, which is all the server stores.

const isoInstant = z.iso.datetime({ offset: true });

export const createBookingSchema = z.object({
  roomId: z.string().min(1, "Оберіть кімнату"),
  // Length and emptiness are checked by validateTitle, so the code stays TITLE_INVALID.
  title: z.string(),
  startsAt: isoInstant,
  endsAt: isoInstant,
  // Total number of weekly occurrences, the first one included. Absent means a
  // single booking.
  repeatWeeks: z.coerce
    .number()
    .int()
    .min(MIN_OCCURRENCES, `Мінімум ${MIN_OCCURRENCES} повторення`)
    .max(MAX_OCCURRENCES, `Максимум ${MAX_OCCURRENCES} повторень`)
    .optional(),
});

// Editing may touch any subset of the fields; whatever is omitted keeps its
// current value and is still re-validated together with the rest.
export const updateBookingSchema = z.object({
  roomId: z.string().min(1, "Оберіть кімнату").optional(),
  title: z.string().optional(),
  startsAt: isoInstant.optional(),
  endsAt: isoInstant.optional(),
});
