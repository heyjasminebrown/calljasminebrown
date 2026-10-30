import type { MetadataRoute } from "next";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand/identity";

const BASE = process.env.APP_BASE_URL ?? DEFAULT_APP_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/book"],
      disallow: ["/api/", "/contacts", "/messages", "/pipeline", "/settings", "/dialer", "/insights", "/notes", "/sequences", "/reports", "/sphere", "/scheduling"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
