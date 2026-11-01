// Eventbrite webhooks carry no data of their own - just an api_url to
// fetch. Each connected Eventbrite account has its own private token
// (EVENTBRITE_PRIVATE_TOKENS, comma-separated), and the payload doesn't say
// which account it came from, so each token is tried until one can read
// the resource.

const API_HOST = "www.eventbriteapi.com";

export function eventbriteTokens(): string[] {
  return (process.env.EVENTBRITE_PRIVATE_TOKENS ?? "")
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function fetchEventbrite<T>(apiUrl: string, expand: string): Promise<T> {
  const url = new URL(apiUrl);
  // Only ever send the tokens to Eventbrite's own API.
  if (url.protocol !== "https:" || url.hostname !== API_HOST) {
    throw new Error(`Refusing to fetch non-Eventbrite URL: ${apiUrl}`);
  }
  url.searchParams.set("expand", expand);

  const tokens = eventbriteTokens();
  if (tokens.length === 0) throw new Error("EVENTBRITE_PRIVATE_TOKENS isn't set in Vercel");

  const failures: string[] = [];
  for (const [i, token] of tokens.entries()) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return (await res.json()) as T;
    const detail = await res.text().catch(() => "");
    failures.push(`token ${i + 1}: HTTP ${res.status} ${detail.slice(0, 200)}`);
    // 401/403/404 = this token's account doesn't own the resource; try the next.
    if (![401, 403, 404].includes(res.status)) break;
  }
  throw new Error(`Eventbrite API refused ${url.pathname} (${failures.join("; ")})`);
}

export type EventbriteProfile = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  cell_phone?: string | null;
};

export type EventbriteEvent = {
  id: string;
  name?: { text?: string | null } | null;
  start?: { utc?: string | null; local?: string | null } | null;
};

export type EventbriteAttendee = {
  id: string;
  order_id?: string | null;
  profile?: EventbriteProfile | null;
  checked_in?: boolean;
  cancelled?: boolean;
  refunded?: boolean;
  event?: EventbriteEvent | null;
};

export type EventbriteOrder = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  event?: EventbriteEvent | null;
  attendees?: EventbriteAttendee[] | null;
};
