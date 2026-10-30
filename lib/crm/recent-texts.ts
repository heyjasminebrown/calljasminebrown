import type { SupabaseClient } from "@supabase/supabase-js";

export type TextThreadMessage =
  | { kind: "text"; direction: "inbound" | "outbound"; body: string; occurredAt: string }
  | {
      kind: "call";
      direction: "inbound" | "outbound" | "none";
      occurredAt: string;
      label: string | null;
      transcript: string | null;
      summary: { bullets: string[]; nextSteps: string[] } | null;
    };

// No window - a thread from months ago must still show, not just "the
// last week or so." Raised from 8: the Dialer's conversation rail wants a
// fuller picture before drafting.
export const RECENT_TEXTS_MAX_PER_CONTACT = 10;

function asCallSummary(v: unknown): { bullets: string[]; nextSteps: string[] } | null {
  if (!v || typeof v !== "object") return null;
  const obj = v as { bullets?: unknown; nextSteps?: unknown };
  if (!Array.isArray(obj.bullets) || !obj.bullets.length) return null;
  return { bullets: obj.bullets as string[], nextSteps: Array.isArray(obj.nextSteps) ? (obj.nextSteps as string[]) : [] };
}

// A short recent thread per contact - used everywhere she's about to text
// someone and wants to see what's already been said before deciding what
// (or whether) to send: the bulk text blast's audience preview, and each
// of the Dialer's three queues. Texts and calls both (a 20-minute call
// last week used to render as nothing at all) - real Quo activity only
// (source: quo), since that's the only place a text's body/direction or a
// call's summary/transcript actually get logged.
export async function fetchRecentTextsByContact(admin: SupabaseClient, ownerId: string, contactIds: string[]): Promise<Map<string, TextThreadMessage[]>> {
  if (contactIds.length === 0) return new Map();

  const { data } = await admin
    .from("activities")
    .select("contact_id, type, body, direction, occurred_at, metadata")
    .eq("owner_id", ownerId)
    .eq("source", "quo")
    .in("type", ["text", "call"])
    .in("contact_id", contactIds)
    .order("occurred_at", { ascending: false });

  const byContact = new Map<string, TextThreadMessage[]>();
  for (const row of data ?? []) {
    const list = byContact.get(row.contact_id) ?? [];
    if (list.length >= RECENT_TEXTS_MAX_PER_CONTACT) continue;

    if (row.type === "text") {
      if (!row.body) continue;
      list.push({ kind: "text", direction: row.direction as "inbound" | "outbound", body: row.body, occurredAt: row.occurred_at });
    } else {
      const metadata = row.metadata as Record<string, unknown> | null;
      list.push({
        kind: "call",
        direction: row.direction as "inbound" | "outbound" | "none",
        occurredAt: row.occurred_at,
        label: row.body,
        transcript: typeof metadata?.transcript === "string" ? metadata.transcript : null,
        summary: asCallSummary(metadata?.ai_call_summary),
      });
    }
    byContact.set(row.contact_id, list);
  }
  // Each list was built newest-first (to cap correctly) - reverse to
  // chronological order for display.
  for (const [contactId, list] of byContact) byContact.set(contactId, list.slice().reverse());
  return byContact;
}
