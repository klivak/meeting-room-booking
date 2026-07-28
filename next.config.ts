import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Language comes from a cookie rather than the address, so the plugin is only
// told where the request configuration lives.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Integration tests start their own server while a dev server may be running,
  // and Next allows only one per build directory. The tests point this at a
  // separate folder; everything else uses the default.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // Naming the framework and its version helps nobody but someone looking for
  // a version to attack.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The application is never meant to be framed, and clickjacking a
          // booking grid is a real if unglamorous attack.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
