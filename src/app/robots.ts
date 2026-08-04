import type { MetadataRoute } from "next";

// Only the sign-in and sign-up pages are reachable without a session, so those
// are the only two worth crawling. Everything else either redirects to /login or
// answers 401, and letting a crawler walk it just spends the budget on nothing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/register"],
      disallow: "/",
    },
  };
}
