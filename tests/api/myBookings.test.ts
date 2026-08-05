import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";

import { OFFICE_TZ } from "@/lib/domain/constants";
import { api, registerUser } from "../helpers/api";
import { createRoom, resetDatabase, testPrisma } from "../helpers/db";

// Comfortably more than two pages at the page size the list uses, without
// importing it: that module reaches the database client, and a test worker has
// none of the server environment it validates on the way in.
const ENOUGH_FOR_SEVERAL_PAGES = 45;

type Page = {
  items: { id: string; startsAt: string }[];
  nextCursor: string | null;
};

let roomId: string;
let cookie: string;
let userId: string;

beforeEach(async () => {
  await resetDatabase();
  roomId = (await createRoom("Хортиця")).id;
  const user = await registerUser("pager@example.com");
  userId = user.id;
  cookie = user.cookie;
});

/**
 * Bookings written straight to the database rather than through the API.
 *
 * The API would refuse most of these: they overlap, and several share a start.
 * That is the point — the paging has to hold for whatever the table contains,
 * and the overlap rule is somebody else's test.
 */
async function seedBookings(count: number, sameStart: boolean) {
  const base = DateTime.now()
    .setZone(OFFICE_TZ)
    .plus({ days: 30 })
    .startOf("day")
    .set({ hour: 10 });

  await testPrisma.booking.createMany({
    data: Array.from({ length: count }, (_, index) => {
      const start = sameStart ? base : base.plus({ days: index });

      return {
        roomId,
        userId,
        title: `Зустріч ${index}`,
        startsAt: start.toJSDate(),
        endsAt: start.plus({ hours: 1 }).toJSDate(),
      };
    }),
  });
}

/** Walks every page and returns the ids in the order they were served. */
async function readAllPages() {
  const ids: string[] = [];
  let cursor: string | null = null;

  do {
    const query: string = cursor
      ? `?scope=upcoming&cursor=${encodeURIComponent(cursor)}`
      : "?scope=upcoming";
    const page: { status: number; body: Page } = await api<Page>(
      `/api/my-bookings${query}`,
      { cookie },
    );

    expect(page.status).toBe(200);
    ids.push(...page.body.items.map((booking) => booking.id));
    cursor = page.body.nextCursor;
  } while (cursor);

  return ids;
}

describe("my bookings paging", () => {
  it("serves every booking exactly once across pages", async () => {
    await seedBookings(ENOUGH_FOR_SEVERAL_PAGES, false);

    const ids = await readAllPages();

    expect(ids).toHaveLength(ENOUGH_FOR_SEVERAL_PAGES);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not repeat or lose rows when a page boundary falls inside one start time", async () => {
    // The list is ordered by startsAt first, so bookings sharing a start are
    // separated only by the tie-break on id. A cursor that named just one of
    // the two columns landed in the middle of that group and either served the
    // same row twice or stepped over some entirely.
    await seedBookings(ENOUGH_FOR_SEVERAL_PAGES, true);

    const ids = await readAllPages();

    expect(ids).toHaveLength(ENOUGH_FOR_SEVERAL_PAGES);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses a cursor that is not one it issued", async () => {
    const response = await api<{ error: { code: string; field?: string } }>(
      "/api/my-bookings?cursor=not-a-cursor",
      { cookie },
    );

    expect(response.status).toBe(400);
    expect(response.body.error.field).toBe("cursor");
  });
});

describe("my bookings paging, cursor row removed", () => {
  it("keeps paging when the booking the cursor names is cancelled in between", async () => {
    await seedBookings(ENOUGH_FOR_SEVERAL_PAGES, false);

    const first = await api<Page>("/api/my-bookings?scope=upcoming", {
      cookie,
    });
    const cursor = first.body.nextCursor;
    expect(cursor).toBeTruthy();

    // The cursor names the last row of the page just shown. Cancelling it takes
    // it out of the filtered set the next page is read from.
    const lastShown = first.body.items[first.body.items.length - 1];
    await testPrisma.booking.update({
      where: { id: lastShown.id },
      data: { canceledAt: new Date() },
    });

    const second = await api<Page>(
      `/api/my-bookings?scope=upcoming&cursor=${encodeURIComponent(cursor!)}`,
      { cookie },
    );

    expect(second.status).toBe(200);
    expect(second.body.items.length).toBeGreaterThan(0);
  });
});
