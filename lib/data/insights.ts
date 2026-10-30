import { createClient } from "@/lib/supabase/server";
import { listContacts, listStages } from "@/lib/data/contacts";
import { filterByQueue } from "@/lib/crm/contact-queue-filter";
import { hasUsablePhone } from "@/lib/crm/contact-filter-predicates";
import { getDuplicateRiskPairs } from "@/lib/data/reports";
import { getWarmRanking, type WarmContact } from "@/lib/data/warm";
import { isDismissedWithin } from "@/lib/crm/dismissed-insights";
import { fullName } from "@/lib/utils";
import { relativeTime } from "@/lib/format-time";
import type { AiInsight, Deal, Representing } from "@/types/database";

const DISMISS_WINDOW_DAYS = 30;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export type SuggestionRow = {
  contactId: string;
  contactName: string;
  contactStageId: string | null;
  contactCreatedAt: string;
  representing: Representing | null;
  insight: AiInsight;
  // Older undismissed insights for this same contact, folded into this one
  // row - applying or dismissing the row resolves these too, so a contact
  // who texted three times in an hour shows one row, not three.
  extraInsightIds: string[];
  meta: string | null;
};

export type SuggestionQueue = {
  count: number;
  names: string[];
  sinceLabel: string;
  rows: SuggestionRow[];
  // Contacts whose only suggestion is a stage change - what "Apply all N
  // stage moves" applies in bulk.
  stageMoveOnlyContactIds: string[];
};

// One row per contact instead of one row per insight - the owner's
// explicit ask: an inbound text should add to a count, not produce a
// second card to dismiss. Excludes known_personally the same way the rest
// of this file's queues do.
export async function getSuggestionQueue(): Promise<SuggestionQueue> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_insights")
    .select("*, contacts!inner(id, first_name, last_name, stage_id, created_at, representing, archived, known_personally)")
    .eq("dismissed", false)
    .eq("contacts.archived", false)
    .eq("contacts.known_personally", false)
    .order("created_at", { ascending: false });

  type JoinedRow = AiInsight & {
    contacts: { id: string; first_name: string; last_name: string; stage_id: string | null; created_at: string; representing: Representing | null };
  };

  const byContact = new Map<string, JoinedRow[]>();
  for (const raw of (data ?? []) as unknown as JoinedRow[]) {
    const list = byContact.get(raw.contact_id) ?? [];
    list.push(raw);
    byContact.set(raw.contact_id, list);
  }

  let oldest: string | null = null;
  const rows: SuggestionRow[] = [];
  for (const list of byContact.values()) {
    const [newest, ...rest] = list;
    const { contacts, ...insight } = newest;
    for (const r of list) {
      if (!oldest || r.created_at < oldest) oldest = r.created_at;
    }
    rows.push({
      contactId: contacts.id,
      contactName: fullName(contacts),
      contactStageId: contacts.stage_id,
      contactCreatedAt: contacts.created_at,
      representing: contacts.representing,
      insight: insight as AiInsight,
      extraInsightIds: rest.map((r) => r.id),
      meta: rest.length > 0 ? `from ${list.length} messages` : null,
    });
  }
  rows.sort((a, b) => b.insight.created_at.localeCompare(a.insight.created_at));

  const stageMoveOnlyContactIds = rows
    .filter((r) => r.insight.suggested_stage_id && !r.insight.suggested_timeline && !(r.insight.suggested_tag_ids && r.insight.suggested_tag_ids.length > 0))
    .map((r) => r.contactId);

  return {
    count: rows.length,
    names: rows.map((r) => r.contactName),
    sinceLabel: oldest ? relativeTime(oldest) : "",
    rows,
    stageMoveOnlyContactIds,
  };
}

export type LeaseRow = { contactId: string; name: string; phone: string | null; month: string; leaseEndsAt: string; dismissKey: string };
export type SimplePerson = { contactId: string; name: string; phone: string | null };
export type ClosedRow = { contactId: string; name: string; phone: string | null; closedAt: string; yearsAgo: number };

export type InsightsData = {
  leases: LeaseRow[];
  warmCount: number;
  warmPreview: Pick<WarmContact, "contactId" | "name" | "phone" | "signalsThisWeek" | "events">[];
  coldHot: SimplePerson[];
  regularsNeverCalled: SimplePerson[];
  pastClientsTwoYears: ClosedRow[];
  noPhoneCount: number;
  duplicatePairs: { aId: string; aName: string; bId: string; bName: string }[];
  registeredNoFollowUp: SimplePerson[];
};

export async function getInsightsData(): Promise<InsightsData> {
  const supabase = await createClient();

  const [contacts, stages, duplicatePairs, warmRanking, { data: dismissals }] = await Promise.all([
    listContacts({}),
    listStages(),
    getDuplicateRiskPairs(),
    getWarmRanking(),
    supabase.from("dismissed_insights").select("insight_key, contact_id, dismissed_at"),
  ]);

  const dismissedByKey = new Map<string, string>();
  const cardLevelDismissed = new Set<string>();
  for (const d of dismissals ?? []) {
    if (d.contact_id) dismissedByKey.set(`${d.insight_key}:${d.contact_id}`, d.dismissed_at);
    else if (isDismissedWithin(d.dismissed_at, DISMISS_WINDOW_DAYS)) cardLevelDismissed.add(d.insight_key);
  }

  const known = contacts.filter((c) => !c.known_personally);

  // --- Leases ending within 90 days ---
  const in90Days = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const leases: LeaseRow[] = known
    .filter((c) => c.lease_ends_at && new Date(c.lease_ends_at).getTime() <= in90Days && new Date(c.lease_ends_at).getTime() >= Date.now())
    .map((c) => {
      const key = `lease_reminder:${c.lease_ends_at}`;
      return {
        contactId: c.id,
        name: fullName(c),
        phone: c.phone,
        month: new Date(c.lease_ends_at!).toLocaleDateString("en-US", { month: "long" }),
        leaseEndsAt: c.lease_ends_at!,
        dismissKey: key,
      };
    })
    .filter((row) => !isDismissedWithin(dismissedByKey.get(`${row.dismissKey}:${row.contactId}`), DISMISS_WINDOW_DAYS))
    .sort((a, b) => a.leaseEndsAt.localeCompare(b.leaseEndsAt));

  // --- Paying attention (a couple of preview rows here - the full ranked list lives on /insights/warm) ---
  const warmMatches = warmRanking.filter((w) => w.tier === "very_warm" || w.tier === "warm");
  const warmCount = warmMatches.length;
  const warmPreview = warmMatches.slice(0, 2).map((w) => ({ contactId: w.contactId, name: w.name, phone: w.phone, signalsThisWeek: w.signalsThisWeek, events: w.events }));

  // --- Hot/Ready gone quiet 30+ days ---
  const coldHotMatches = cardLevelDismissed.has("cold_from_hot") ? [] : await filterByQueue(known, "cold_from_hot", stages);
  const coldHot: SimplePerson[] = coldHotMatches.map((c) => ({ contactId: c.id, name: fullName(c), phone: c.phone }));

  // --- Regulars (2+ meetups) never called ---
  let regularsNeverCalled: SimplePerson[] = [];
  if (!cardLevelDismissed.has("regulars_never_called")) {
    const repeatAttendees = await filterByQueue(known, "repeat_attendees", stages);
    const neverCalledIds = new Set((await filterByQueue(known, "never_called", stages)).map((c) => c.id));
    regularsNeverCalled = repeatAttendees.filter((c) => neverCalledIds.has(c.id)).map((c) => ({ contactId: c.id, name: fullName(c), phone: c.phone }));
  }

  // --- Past clients, 2+ years since closing ---
  let pastClientsTwoYears: ClosedRow[] = [];
  if (!cardLevelDismissed.has("past_clients_two_years")) {
    const { data: won } = await supabase.from("deals").select("*").eq("status", "won");
    const computedWon = (won ?? []) as Deal[];
    const latestCloseByContact = new Map<string, string>();
    for (const d of computedWon) {
      if (!d.contact_id) continue;
      const cur = latestCloseByContact.get(d.contact_id);
      if (!cur || d.closed_at > cur) latestCloseByContact.set(d.contact_id, d.closed_at);
    }
    const knownById = new Map(known.map((c) => [c.id, c]));
    for (const [contactId, closedAt] of latestCloseByContact) {
      const contact = knownById.get(contactId);
      if (!contact) continue;
      const ageMs = Date.now() - new Date(closedAt).getTime();
      if (ageMs < TWO_YEARS_MS) continue;
      pastClientsTwoYears.push({
        contactId,
        name: fullName(contact),
        phone: contact.phone,
        closedAt,
        yearsAgo: Math.floor(ageMs / (365 * 24 * 60 * 60 * 1000)),
      });
    }
    pastClientsTwoYears.sort((a, b) => b.yearsAgo - a.yearsAgo);
  }

  // --- Data problems: no phone, duplicates ---
  const noPhone = cardLevelDismissed.has("data_problems") ? [] : known.filter((c) => !hasUsablePhone(c.phone));

  // --- Registered for an event, no follow-up since ---
  let registeredNoFollowUp: SimplePerson[] = [];
  if (!cardLevelDismissed.has("registered_no_followup")) {
    const matches = await filterByQueue(known, "no_followup_after_registration", stages);
    registeredNoFollowUp = matches.map((c) => ({ contactId: c.id, name: fullName(c), phone: c.phone }));
  }

  return {
    leases,
    warmCount,
    warmPreview,
    coldHot,
    regularsNeverCalled,
    pastClientsTwoYears,
    noPhoneCount: noPhone.length,
    duplicatePairs: cardLevelDismissed.has("data_problems") ? [] : duplicatePairs,
    registeredNoFollowUp,
  };
}
