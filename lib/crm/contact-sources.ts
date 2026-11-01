// Canonical Contacts v2 source buckets (Nico SoT). lead_source is free
// text, so the filter matches aliases rather than requiring an exact
// string. Display chips use the bucket label when we can map one.

export const CONTACT_SOURCE_FILTERS = [
  { value: "event", label: "Event", match: ["eventbrite", "meetup", "jotform", "event"] },
  { value: "facebook", label: "Facebook", match: ["facebook", "fb"] },
  { value: "instagram", label: "Instagram", match: ["instagram"] },
  { value: "youtube", label: "YouTube", match: ["youtube"] },
  { value: "tiktok", label: "TikTok", match: ["tiktok", "tik tok"] },
  { value: "website", label: "Website", match: ["website", "site_form", "web form"] },
  { value: "conventus", label: "Conventus", match: ["conventus"] },
] as const;

export type ContactSourceFilterValue = (typeof CONTACT_SOURCE_FILTERS)[number]["value"];

function haystack(value: string): string {
  return value.trim().toLowerCase();
}

export function sourceFilterByValue(value: string | null | undefined) {
  if (!value) return undefined;
  const key = haystack(value);
  return CONTACT_SOURCE_FILTERS.find((s) => s.value === key || haystack(s.label) === key);
}

export function leadSourceMatches(leadSource: string | null | undefined, filter: string): boolean {
  if (!leadSource?.trim() || !filter.trim()) return false;
  const bucket = sourceFilterByValue(filter);
  const hay = haystack(leadSource);
  if (bucket) {
    if (bucket.value === "event") {
      return bucket.match.some((token) => hay.includes(token)) && !hay.includes("open house") && !hay.includes("openhouse");
    }
    return bucket.match.some((token) => hay.includes(token));
  }
  return hay === haystack(filter);
}

export function sourceChipLabel(leadSource: string | null | undefined): string | null {
  const raw = leadSource?.trim();
  if (!raw) return null;
  const bucket = CONTACT_SOURCE_FILTERS.find((s) => leadSourceMatches(raw, s.value));
  return bucket?.label ?? raw;
}
