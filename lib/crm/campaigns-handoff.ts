// Bulk Text on Contacts must not rebuild the Campaigns composer.
// Hand selected IDs into /sequences so the existing texter opens with
// that audience preloaded.

export function campaignsTextHref(contactIds: string[]): string {
  const ids = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  const qs = params.toString();
  return qs ? `/sequences?${qs}` : "/sequences";
}

export function parseCampaignAudienceIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}
