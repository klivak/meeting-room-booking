import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Integration tests start their own server while a dev server may be running,
  // and Next allows only one per build directory. The tests point this at a
  // separate folder; everything else uses the default.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
