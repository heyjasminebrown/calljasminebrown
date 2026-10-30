import type { SupabaseClient } from "@supabase/supabase-js";
import { isPast } from "date-fns";
import { phonesMatch } from "@/lib/phone";
import { fullName } from "@/lib/utils";
import { isTodayLocal, relativeTime } from "@/lib/format-time";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export type WeeklyReviewPayload = {
  generatedAt: string;
  whatHappened: {
    summary: string;
    stats: { label: string; value: number; previous: number }[];
    underContractNow: number;
  };
  mondaysCalls: { contactId: string; name: string; reason: string }[];
  doubleRegistrations: { contactId: string; name: string; firstActivityId: string; secondActivityId: string }[];
  duplicatePhonePairs: { aId: string; aName: string; bId: string; bName: string }[];
  noPhoneRegistrantsCount: number;
  possiblyKnownPersonally: { contactId: string; name: string; matchedName: string; matchedOn: "surname" | "phone" }[];
};

// Built once a week by the Sunday cron, which runs with no logged-in
// session - every query here goes through the passed-in admin client
// (service role, bypasses RLS) rather than reusing lib/data/today.ts or
// lib/data/reports.ts's helpers, which all call the cookie-session-scoped
// createClient() and would silently return empty results with no user
// signed in. Some logic is duplicated from those files as a result (the
// Calls-group shape, a phone-only duplicate scan) - a small, deliberate
// cost of keeping this cron path correct rather than sharing code that
// only works in a request with a real session.
export async function buildWeeklyReview(admin: SupabaseClient, ownerId: string): Promise<WeeklyReviewPayload> {
  const weekAgo = daysAgo(7);
  const twoWeeksAgo = daysAgo(14);

  const [{ data: newLeads }, { data: calls }, { data: texts }, { data: showingsThis }, { data: showingsPrev }, { data: dealsThisWeek }] =
    await Promise.all([
      admin.from("contacts").select("id, lead_source").eq("owner_id", ownerId).eq("archived", false).gte("lead_date", weekAgo),
      admin.from("activities").select("id").eq("owner_id", ownerId).eq("type", "call").gte("occurred_at", weekAgo),
      admin.from("activities").select("id").eq("owner_id", ownerId).eq("type", "text").gte("occurred_at", weekAgo),
      admin.from("activities").select("id").eq("owner_id", ownerId).eq("type", "showing").gte("occurred_at", weekAgo),
      admin.from("activities").select("id").eq("owner_id", ownerId).eq("type", "showing").gte("occurred_at", twoWeeksAgo).lt("occurred_at", weekAgo),
      admin
        .from("deals")
        .select("contact_id, status, gross_commission, contacts(first_name,last_name)")
        .eq("owner_id", ownerId)
        .gte("closed_at", weekAgo),
    ]);
  const [{ data: prevNewLeads }, { data: prevCalls }] = await Promise.all([
    admin.from("contacts").select("id").eq("owner_id", ownerId).eq("archived", false).gte("lead_date", twoWeeksAgo).lt("lead_date", weekAgo),
    admin.from("activities").select("id").eq("owner_id", ownerId).eq("type", "call").gte("occurred_at", twoWeeksAgo).lt("occurred_at", weekAgo),
  ]);

  const sourceCounts = new Map<string, number>();
  for (const c of newLeads ?? []) {
    const s = c.lead_source?.trim() || "Unknown";
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const topSource = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const notableDeal = (dealsThisWeek ?? []).sort((a, b) => (b.gross_commission ?? 0) - (a.gross_commission ?? 0))[0];
  const notableContact = notableDeal?.contacts as unknown as { first_name: string; last_name: string } | null;

  const summaryParts = [
    `${newLeads?.length ?? 0} new lead${(newLeads?.length ?? 0) === 1 ? "" : "s"} this week${topSource ? `, most from ${topSource}` : ""}.`,
    `You spoke to people ${calls?.length ?? 0} time${(calls?.length ?? 0) === 1 ? "" : "s"} and sent ${texts?.length ?? 0} text${(texts?.length ?? 0) === 1 ? "" : "s"}.`,
    notableDeal && notableContact
      ? `A deal moved for ${fullName(notableContact)}${notableDeal.gross_commission ? ` - ${notableDeal.gross_commission.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} to you when it closes.` : "."}`
      : null,
  ].filter(Boolean);

  // --- Under contract now: current snapshot, not a week-over-week delta -
  // nothing stores a historical count to compare against. ---
  const { data: underContractStages } = await admin.from("pipeline_stages").select("id").eq("owner_id", ownerId).eq("is_under_contract", true);
  const underContractStageIds = (underContractStages ?? []).map((s) => s.id);
  let underContractNow = 0;
  if (underContractStageIds.length > 0) {
    const { count } = await admin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("archived", false)
      .in("stage_id", underContractStageIds);
    underContractNow = count ?? 0;
  }

  // --- Monday's calls: same shape as Today's Calls group, top 5 by follow-up date ---
  const { data: followUps } = await admin
    .from("contacts")
    .select("id, first_name, last_name, next_follow_up_at, known_personally")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .not("next_follow_up_at", "is", null)
    .order("next_follow_up_at", { ascending: true })
    .limit(20);
  const mondaysCalls = (followUps ?? [])
    .filter((c) => !c.known_personally)
    .slice(0, 5)
    .map((c) => {
      const due = new Date(c.next_follow_up_at as string);
      const today = isTodayLocal(c.next_follow_up_at as string);
      const overdue = isPast(due) && !today;
      const reason = overdue ? `${relativeTime(due)} · follow-up` : today ? "Due today" : `Due ${relativeTime(due)}`;
      return { contactId: c.id, name: fullName(c), reason };
    });

  // --- Double registrations: same contact, 2 Eventbrite registrations <5s apart ---
  const { data: recentRegistrations } = await admin
    .from("activities")
    .select("id, contact_id, occurred_at, contacts(first_name,last_name)")
    .eq("owner_id", ownerId)
    .eq("source", "eventbrite")
    .gte("occurred_at", weekAgo)
    .order("occurred_at", { ascending: true });
  const byContact = new Map<string, { id: string; occurred_at: string }[]>();
  for (const r of recentRegistrations ?? []) {
    if (!byContact.has(r.contact_id)) byContact.set(r.contact_id, []);
    byContact.get(r.contact_id)!.push({ id: r.id, occurred_at: r.occurred_at });
  }
  const doubleRegistrations: WeeklyReviewPayload["doubleRegistrations"] = [];
  for (const r of recentRegistrations ?? []) {
    const siblings = byContact.get(r.contact_id) ?? [];
    if (siblings.length < 2) continue;
    const [first, second] = siblings;
    if (Math.abs(new Date(second.occurred_at).getTime() - new Date(first.occurred_at).getTime()) < 5000) {
      const contact = r.contacts as unknown as { first_name: string; last_name: string } | null;
      if (contact && !doubleRegistrations.some((d) => d.contactId === r.contact_id)) {
        doubleRegistrations.push({ contactId: r.contact_id, name: fullName(contact), firstActivityId: first.id, secondActivityId: second.id });
      }
    }
  }

  // --- Duplicate records sharing a phone (phone-only, not email - matches the design's specific "sharing a phone" check) ---
  const { data: allContacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .not("phone", "is", null);
  const duplicatePhonePairs: WeeklyReviewPayload["duplicatePhonePairs"] = [];
  const contacts = allContacts ?? [];
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      if (phonesMatch(contacts[i].phone, contacts[j].phone)) {
        duplicatePhonePairs.push({ aId: contacts[i].id, aName: fullName(contacts[i]), bId: contacts[j].id, bName: fullName(contacts[j]) });
      }
    }
  }

  // --- Registrants with no phone number, this week ---
  const { count: noPhoneCount } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .is("phone", null)
    .gte("lead_date", weekAgo);

  // --- New registrants sharing a surname or phone with someone already in the sphere ---
  const { data: recentContacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, known_personally")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .gte("lead_date", weekAgo);
  const { data: sphereContacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, pipeline_stages(is_closed_won)")
    .eq("owner_id", ownerId)
    .eq("archived", false);
  const possiblyKnownPersonally: WeeklyReviewPayload["possiblyKnownPersonally"] = [];
  for (const c of recentContacts ?? []) {
    if (c.known_personally) continue;
    for (const s of sphereContacts ?? []) {
      const stage = Array.isArray(s.pipeline_stages) ? s.pipeline_stages[0] : s.pipeline_stages;
      if (s.id === c.id || !stage?.is_closed_won) continue;
      if (phonesMatch(c.phone, s.phone)) {
        possiblyKnownPersonally.push({ contactId: c.id, name: fullName(c), matchedName: fullName(s), matchedOn: "phone" });
        break;
      }
      if (c.last_name && s.last_name && c.last_name.trim().toLowerCase() === s.last_name.trim().toLowerCase()) {
        possiblyKnownPersonally.push({ contactId: c.id, name: fullName(c), matchedName: fullName(s), matchedOn: "surname" });
        break;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    whatHappened: {
      summary: summaryParts.join(" "),
      stats: [
        { label: "Calls", value: calls?.length ?? 0, previous: prevCalls?.length ?? 0 },
        { label: "New leads", value: newLeads?.length ?? 0, previous: prevNewLeads?.length ?? 0 },
        { label: "Showings", value: showingsThis?.length ?? 0, previous: showingsPrev?.length ?? 0 },
      ],
      underContractNow,
    },
    mondaysCalls,
    doubleRegistrations,
    duplicatePhonePairs,
    noPhoneRegistrantsCount: noPhoneCount ?? 0,
    possiblyKnownPersonally,
  };
}

// The card's payload is a snapshot written once by the Sunday cron - it
// never gets rewritten just because a row was acted on, so without this,
// clicking "Fix to New"/"Merge"/"Leave it" only hid the row for the rest
// of that page's lifetime (component state), and it came right back on
// the next visit even though the underlying fix genuinely took. This
// re-checks each actionable row's real current state on every load instead
// of trusting the stale snapshot: a double-registration whose second
// activity was deleted, a duplicate pair whose contact was merged away, or
// a person since marked known-personally are all dropped; an explicit
// "Leave it"/"Compare later" is tracked the same way every other card's
// dismiss button is, via dismissed_insights.
export async function filterResolvedWeeklyReviewItems(supabase: SupabaseClient, ownerId: string, payload: WeeklyReviewPayload): Promise<WeeklyReviewPayload> {
  const secondActivityIds = payload.doubleRegistrations.map((d) => d.secondActivityId);
  const dupContactIds = payload.duplicatePhonePairs.flatMap((p) => [p.aId, p.bId]);
  const knownIds = payload.possiblyKnownPersonally.map((k) => k.contactId);

  const [survivingActivities, survivingContacts, knownContacts, dismissals] = await Promise.all([
    secondActivityIds.length > 0
      ? supabase.from("activities").select("id").in("id", secondActivityIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    dupContactIds.length > 0
      ? supabase.from("contacts").select("id").in("id", dupContactIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    knownIds.length > 0
      ? supabase.from("contacts").select("id, known_personally").in("id", knownIds)
      : Promise.resolve({ data: [] as { id: string; known_personally: boolean }[] }),
    supabase
      .from("dismissed_insights")
      .select("insight_key, contact_id, dismissed_at")
      .eq("owner_id", ownerId)
      .in("insight_key", ["weekly_review_double", "weekly_review_dup"]),
  ]);

  const survivingActivityIds = new Set((survivingActivities.data ?? []).map((a) => a.id));
  const survivingContactIds = new Set((survivingContacts.data ?? []).map((c) => c.id));
  const stillNotKnown = new Set((knownContacts.data ?? []).filter((c) => !c.known_personally).map((c) => c.id));
  const dismissedKeys = new Set((dismissals.data ?? []).map((d) => `${d.insight_key}:${d.contact_id}`));

  return {
    ...payload,
    doubleRegistrations: payload.doubleRegistrations.filter(
      (d) => survivingActivityIds.has(d.secondActivityId) && !dismissedKeys.has(`weekly_review_double:${d.contactId}`),
    ),
    duplicatePhonePairs: payload.duplicatePhonePairs.filter(
      (p) => survivingContactIds.has(p.aId) && survivingContactIds.has(p.bId) && !dismissedKeys.has(`weekly_review_dup:${p.bId}`),
    ),
    possiblyKnownPersonally: payload.possiblyKnownPersonally.filter((k) => stillNotKnown.has(k.contactId)),
  };
}
