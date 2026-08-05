import { NextResponse, type NextRequest } from "next/server";

// The Content-Security-Policy lives here rather than in next.config.ts because
// it carries a nonce, and a nonce has to be new for every response — a value
// baked into the config would be a constant, which is the one thing a nonce
// must not be.
//
// Why a nonce at all: the document head runs an inline script that applies the
// stored theme before the first paint, and Next injects inline scripts of its
// own for hydration. The alternative to naming them by nonce is 'unsafe-inline',
// which allows every other inline script too and leaves the policy meaning
// almost nothing.

/** The policy for one response, with the nonce that response's scripts carry. */
function contentSecurityPolicy(nonce: string): string {
  const development = process.env.NODE_ENV !== "production";

  return [
    "default-src 'self'",
    // strict-dynamic lets the nonced Next bootstrap load the rest of the
    // bundle, so the chunk file names do not have to be listed here.
    // The dev server compiles pages in the browser with eval, which production
    // never does.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Tailwind ships a stylesheet, but next/font and React both write inline
    // style attributes, and a nonce cannot cover those.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // next/font self-hosts Google fonts at build time, so nothing is fetched
    // from a font CDN at runtime.
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // The same rule as the X-Frame-Options header, in the form browsers now
    // actually read.
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID();

  // The header goes on the request as well: that is how the layout reads the
  // nonce back to put it on its own inline script.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  return response;
}

export const config = {
  // Static assets and the image optimizer serve no HTML, so a policy on them
  // would only cost a middleware invocation per file.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|png|svg|ico|webp)$).*)",
  ],
};
