import { createClient } from "@/lib/supabase/server";
import { isDismissedWithin } from "@/lib/crm/dismissed-insights";
import type { Deal } from "@/types/database";

// The original app computed a net-of-fees commission figure here via a
// brokerage-specific split/cap formula (lib/crm/commission.ts), which this
// chassis intentionally excludes (see README). This chassis just uses the
// deal's own gross_commission as a plain dollar "value" instead - swap in
// whatever your own deals table tracks (e.g. loan amount, fee, revenue).
function dealValue(deal: Deal): number {
  return deal.gross_commission ?? 0;
}

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

type PastClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  known_personally: boolean;
  pipeline_stages: { is_closed_won: boolean } | { is_closed_won: boolean }[] | null;
};

export type MonthHighlight = {
  contactId: string;
  name: string;
  kind: "anniversary" | "birthday";
  label: string;
  meta: string;
};

export type GoingQuietClient = {
  contactId: string;
  name: string;
  phone: string | null;
  closedAt: string;
  lastOutreachAt: string | null;
  monthsQuiet: number;
  referralsSent: number;
};

export type ReferrerRow = {
  contactId: string;
  name: string;
  referralCount: number;
  closedCount: number;
  pendingCount: number;
  value: number;
};

export type ReviewCandidate = {
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  dealId: string;
  closedAt: string;
  daysAgo: number;
};

function monthDay(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function isClosedWon(stages: PastClientRow["pipeline_stages"]): boolean {
  const stage = Array.isArray(stages) ? stages[0] : stages;
  return !!stage?.is_closed_won;
}

export async function getSphereData() {
  const supabase = await createClient();

  const [{ data: contacts }, { data: wonDeals }, { data: pendingDeals }, { data: dismissals }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, phone, email, birthday, known_personally, referred_by, archived, pipeline_stages(is_closed_won)")
      .eq("archived", false),
    supabase.from("deals").select("*").eq("status", "won"),
    supabase.from("deals").select("contact_id, status").eq("status", "pending"),
    supabase.from("dismissed_insights").select("insight_key, dismissed_at").like("insight_key", "review_%"),
  ]);

  const allContacts = (contacts ?? []) as (PastClientRow & { referred_by: string | null; archived: boolean })[];
  const contactById = new Map(allContacts.map((c) => [c.id, c]));
  const pastClients = allContacts.filter((c) => isClosedWon(c.pipeline_stages));
  const pastClientIds = new Set(pastClients.map((c) => c.id));

  const won = (wonDeals ?? []) as Deal[];
  const computedWon = won;
  const wonByContact = new Map<string, typeof computedWon>();
  for (const d of computedWon) {
    if (!d.contact_id) continue;
    if (!wonByContact.has(d.contact_id)) wonByContact.set(d.contact_id, []);
    wonByContact.get(d.contact_id)!.push(d);
  }
  const pendingContactIds = new Set((pendingDeals ?? []).map((d) => d.contact_id).filter(Boolean) as string[]);

  // --- Outreach recency, scoped to past clients only ---
  const { data: activities } = await supabase
    .from("activities")
    .select("contact_id, occurred_at")
    .in("type", ["call", "text", "email"])
    .in("contact_id", [...pastClientIds]);
  const lastOutreachByContact = new Map<string, string>();
  for (const a of activities ?? []) {
    const cur = lastOutreachByContact.get(a.contact_id);
    if (!cur || a.occurred_at > cur) lastOutreachByContact.set(a.contact_id, a.occurred_at);
  }

  // --- This month: anniversaries + birthdays ---
  const today = monthDay(new Date().toISOString());
  const thisMonth: MonthHighlight[] = [];
  for (const c of pastClients) {
    if (c.known_personally) continue;
    const deals = wonByContact.get(c.id) ?? [];
    const anniversaryDeal = deals.find((d) => monthDay(d.closed_at) === today);
    if (anniversaryDeal) {
      const years = new Date().getUTCFullYear() - new Date(anniversaryDeal.closed_at).getUTCFullYear();
      thisMonth.push({
        contactId: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        kind: "anniversary",
        label: `${years === 1 ? "One year" : `${years} years`} in the house`,
        meta: `Closed ${new Date(anniversaryDeal.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      });
    }
  }
  for (const c of allContacts) {
    if (c.known_personally || !c.birthday) continue;
    if (monthDay(c.birthday) !== today) continue;
    thisMonth.push({
      contactId: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      kind: "birthday",
      label: "Birthday today",
      meta: "",
    });
  }

  // --- Past clients going quiet (6+ months, no won deal = skip since they'd need a close first) ---
  const goingQuiet: GoingQuietClient[] = [];
  for (const c of pastClients) {
    const deals = wonByContact.get(c.id) ?? [];
    if (deals.length === 0) continue;
    const mostRecentClose = deals.reduce((max, d) => (d.closed_at > max ? d.closed_at : max), deals[0].closed_at);
    const lastOutreach = lastOutreachByContact.get(c.id) ?? null;
    const sinceMs = Date.now() - new Date(lastOutreach ?? mostRecentClose).getTime();
    if (sinceMs < SIX_MONTHS_MS) continue;
    goingQuiet.push({
      contactId: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      phone: c.phone,
      closedAt: mostRecentClose,
      lastOutreachAt: lastOutreach,
      monthsQuiet: Math.floor(sinceMs / (30 * 24 * 60 * 60 * 1000)),
      referralsSent: allContacts.filter((r) => r.referred_by === c.id).length,
    });
  }
  goingQuiet.sort((a, b) => b.monthsQuiet - a.monthsQuiet);

  // --- Who sends you business ---
  const referrerIds = new Set(allContacts.map((c) => c.referred_by).filter((id): id is string => !!id));
  const referrers: ReferrerRow[] = [...referrerIds]
    .map((id) => {
      const referrer = contactById.get(id);
      if (!referrer) return null;
      const referred = allContacts.filter((c) => c.referred_by === id);
      const closedReferred = referred.filter((c) => wonByContact.has(c.id));
      const pendingReferred = referred.filter((c) => !wonByContact.has(c.id) && pendingContactIds.has(c.id));
      const value = closedReferred.reduce((sum, c) => sum + (wonByContact.get(c.id) ?? []).reduce((s, d) => s + dealValue(d), 0), 0);
      return {
        contactId: id,
        name: `${referrer.first_name} ${referrer.last_name}`.trim(),
        referralCount: referred.length,
        closedCount: closedReferred.length,
        pendingCount: pendingReferred.length,
        value,
      };
    })
    .filter((r): r is ReferrerRow => !!r)
    .sort((a, b) => b.value - a.value);

  // --- Review request candidates: closed 3-21 days ago, not yet dismissed/snoozed/sent ---
  const dismissedKeys = new Map((dismissals ?? []).map((d) => [d.insight_key, d.dismissed_at]));
  const now = Date.now();
  const reviewCandidates: ReviewCandidate[] = [];
  for (const [dealId, d] of computedWon.map((d) => [d.id, d] as const)) {
    if (!d.contact_id) continue;
    const contact = contactById.get(d.contact_id);
    if (!contact || contact.known_personally) continue;
    const daysAgo = Math.floor((now - new Date(d.closed_at).getTime()) / (24 * 60 * 60 * 1000));
    if (daysAgo < 3 || daysAgo > 21) continue;
    if (dismissedKeys.has(`review_dismissed:${dealId}`)) continue;
    if (isDismissedWithin(dismissedKeys.get(`review_snoozed:${dealId}`), 7)) continue;
    reviewCandidates.push({
      contactId: contact.id,
      name: `${contact.first_name} ${contact.last_name}`.trim(),
      phone: contact.phone,
      email: contact.email,
      dealId,
      closedAt: d.closed_at,
      daysAgo,
    });
  }

  return {
    totalPastClients: pastClients.length,
    totalReferrers: referrers.length,
    thisMonth,
    goingQuiet,
    referrers,
    reviewCandidates,
  };
}
