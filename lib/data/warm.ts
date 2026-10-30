import { createClient } from "@/lib/supabase/server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BASELINE_WEEKS = 8;

export type WarmTier = "very_warm" | "warm" | "reading" | "steady";

export type WarmEvent = { date: string; label: string };

export type WarmContact = {
  contactId: string;
  name: string;
  phone: string | null;
  signalsThisWeek: number;
  baselinePerWeek: number;
  deviation: number;
  tier: WarmTier;
  events: WarmEvent[];
};

function tierFor(deviation: number, signalsThisWeek: number): WarmTier {
  if (signalsThisWeek === 0) return "steady";
  if (deviation >= 3) return "very_warm";
  if (deviation >= 1.5) return "warm";
  return "reading";
}

// Ranks by recency + burst, not raw volume - a steady reader who opens
// everything every week has a high baseline, so this week looking like
// every other week keeps them at "steady" even with a high open count.
// Someone quiet for months who suddenly opens/clicks twice this week
// deviates hard from their own (near-zero) baseline and ranks high.
//
// email_sequence_sends only stores the MOST RECENT open/click timestamp
// per send plus a cumulative count (not a timestamp per individual open),
// so "this row's signal happened within the window" is approximated as
// opened_at/clicked_at falling in that window, weighted by the row's
// open_count/click_count - same recency+count approximation
// lib/crm/engagement.ts's hasRecentEmailEngagement already uses for a
// single contact; this generalizes it into a cross-contact ranking.
export async function getWarmRanking(): Promise<WarmContact[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - BASELINE_WEEKS * WEEK_MS).toISOString();
  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();

  const { data: sends } = await supabase
    .from("email_sequence_sends")
    .select("contact_id, opened_at, open_count, clicked_at, click_count, contacts!inner(id, first_name, last_name, phone, known_personally, archived)")
    .or(`opened_at.gte.${since},clicked_at.gte.${since}`);

  const byContact = new Map<string, { name: string; phone: string | null; thisWeek: number; total: number; events: WarmEvent[] }>();
  for (const row of sends ?? []) {
    const contact = row.contacts as unknown as { id: string; first_name: string; last_name: string; phone: string | null; known_personally: boolean; archived: boolean };
    if (!contact || contact.archived || contact.known_personally) continue;

    // The first open on any send is discounted to zero, not counted as a
    // real signal - Apple Mail's Mail Privacy Protection (on by default
    // since 2021) auto-fetches every tracking pixel the moment mail is
    // delivered, whether or not the person ever looks at it, so open_count
    // hitting 1 is closer to noise than interest. A genuine second (or
    // third+) open still requires someone actually reopening the email
    // later, which a background prefetch doesn't do - same "2+ opens is
    // the real signal" threshold lib/crm/engagement.ts's
    // hasRecentEmailEngagement already uses for the Engaged tag, applied
    // here too so warm-ranking can't be inflated by the same false
    // positive.
    const openSignal = row.opened_at && row.opened_at >= since ? Math.max(0, (row.open_count ?? 0) - 1) : 0;
    const clickSignal = row.clicked_at && row.clicked_at >= since ? (row.click_count ?? 0) * 2 : 0;
    const openThisWeek = row.opened_at && row.opened_at >= weekAgo ? Math.max(0, (row.open_count ?? 0) - 1) : 0;
    const clickThisWeek = row.clicked_at && row.clicked_at >= weekAgo ? (row.click_count ?? 0) * 2 : 0;

    const entry = byContact.get(contact.id) ?? { name: `${contact.first_name} ${contact.last_name}`.trim(), phone: contact.phone, thisWeek: 0, total: 0, events: [] };
    entry.thisWeek += openThisWeek + clickThisWeek;
    entry.total += openSignal + clickSignal;
    if (row.clicked_at && row.clicked_at >= since) {
      entry.events.push({ date: row.clicked_at, label: `Clicked through${(row.click_count ?? 0) > 1 ? ` (${row.click_count} times)` : ""}` });
    }
    if (row.opened_at && row.opened_at >= since) {
      entry.events.push({ date: row.opened_at, label: `Opened your email${(row.open_count ?? 0) > 1 ? ` (${row.open_count} times)` : ""}` });
    }
    byContact.set(contact.id, entry);
  }

  // The original app also fed this ranking from views of a "numbers"
  // quote page (a house-hack/loan calculator feature intentionally
  // excluded from this chassis - see README). Email engagement alone
  // still drives the ranking below; add your own second signal source
  // here the same way if you have one (e.g. a pricing page view).

  const ranked: WarmContact[] = [...byContact.entries()]
    .map(([contactId, v]) => {
      const baselinePerWeek = v.total / BASELINE_WEEKS;
      const deviation = v.thisWeek / Math.max(baselinePerWeek, 0.25);
      return {
        contactId,
        name: v.name,
        phone: v.phone,
        signalsThisWeek: v.thisWeek,
        baselinePerWeek,
        deviation,
        tier: tierFor(deviation, v.thisWeek),
        events: v.events.sort((a, b) => b.date.localeCompare(a.date)),
      };
    })
    .filter((c) => c.signalsThisWeek > 0)
    .sort((a, b) => b.deviation - a.deviation || b.signalsThisWeek - a.signalsThisWeek);

  return ranked;
}
