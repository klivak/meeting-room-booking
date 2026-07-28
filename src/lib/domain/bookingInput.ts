import { z } from "zod";

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
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// Editing may touch any subset of the fields; whatever is omitted keeps its
// current value and is still re-validated together with the rest.
export const updateBookingSchema = z.object({
  roomId: z.string().min(1, "Оберіть кімнату").optional(),
  title: z.string().optional(),
  startsAt: isoInstant.optional(),
  endsAt: isoInstant.optional(),
});

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
