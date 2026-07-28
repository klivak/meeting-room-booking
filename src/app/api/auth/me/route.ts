import { NextResponse } from "next/server";

import { unauthorizedError } from "@/lib/server/apiError";
import { getCurrentUser } from "@/lib/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return await unauthorizedError();
  }

  return NextResponse.json(user);
}
