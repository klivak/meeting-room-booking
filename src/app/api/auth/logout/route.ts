import { NextResponse } from "next/server";

import { destroySession } from "@/lib/server/session";

// Logging out twice is not an error: the goal is simply that no session remains.
export async function POST() {
  await destroySession();

  return new NextResponse(null, { status: 204 });
}
