import { NextResponse } from "next/server";

import { confirmVerificationToken } from "@/lib/server/verification";

// Opened from the link in the server log, so it answers with a redirect rather
// than JSON: the person clicking it expects to land in the application.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const confirmed = token ? await confirmVerificationToken(token) : false;

  const target = new URL(
    confirmed ? "/?verified=1" : "/?verified=0",
    request.url,
  );

  return NextResponse.redirect(target);
}
