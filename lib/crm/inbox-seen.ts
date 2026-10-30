export const INBOX_SEEN_COOKIE = "cc_inbox_seen";
export const INBOX_SEEN_MAX = 200;

export function parseInboxSeen(raw: string | undefined | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function markInboxSeen(map: Record<string, string>, contactId: string, at = new Date().toISOString()): Record<string, string> {
  const next = { ...map, [contactId]: at };
  const entries = Object.entries(next).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1]));
  if (entries.length <= INBOX_SEEN_MAX) return Object.fromEntries(entries);
  return Object.fromEntries(entries.slice(0, INBOX_SEEN_MAX));
}
