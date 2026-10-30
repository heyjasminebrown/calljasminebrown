import type { MetadataRoute } from "next";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand/identity";

const BASE = process.env.APP_BASE_URL ?? DEFAULT_APP_ORIGIN;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/login`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/book`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
