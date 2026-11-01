import { createClient } from "@/lib/supabase/server";
import type { Period } from "@/lib/data/metrics";
import { RELATIONSHIP_TYPE_LABELS } from "@/lib/utils";
import { phonesMatch } from "@/lib/phone";
import type { Deal, RelationshipType } from "@/types/database";

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30 };

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

type MonthBucket = { key: string; label: string; start: Date; end: Date };

function monthBucket(monthsFromNow: number): MonthBucket {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthsFromNow + 1, 1);
  return {
    key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label: start.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    start,
    end,
  };
}

// Calendar months, not rolling 30-day windows - "is this source trending up"
// reads naturally as Jan/Feb/Mar, and lines up with how the commission/deal
// numbers below are usually thought about.
function lastNMonths(n: number): MonthBucket[] {
  return Array.from({ length: n }, (_, i) => monthBucket(i - (n - 1)));
}

function nextNMonths(n: number): MonthBucket[] {
  return Array.from({ length: n }, (_, i) => monthBucket(i));
}

export type NewLeadsBySource = { source: string; count: number };

export type NewLeadsReportData = {
  total: number;
  bySource: NewLeadsBySource[];
};

// Filtered on lead_date (the lead's real original date), not created_at (when
// the row was inserted) - a bulk CSV import inserts everything "now", which
// would otherwise make a months-old backfilled contact look like it just
// came in this week. Same rolling window as the dashboard's tiles and the
// Accountability metrics, so "this week" means the same thing everywhere.
export async function getNewLeadsReport(period: Period): Promise<NewLeadsReportData> {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("lead_source")
    .eq("archived", false)
    .gte("lead_date", daysAgo(PERIOD_DAYS[period]));

  const countBySource = new Map<string, number>();
  for (const c of contacts ?? []) {
    const source = c.lead_source?.trim() || "Unknown";
    countBySource.set(source, (countBySource.get(source) ?? 0) + 1);
  }

  return {
    total: contacts?.length ?? 0,
    bySource: [...countBySource.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export type LeadSourceReportRow = {
  source: string;
  contactCount: number;
  convertedCount: number;
  conversionRate: number;
  wonDealCount: number;
  grossCommission: number;
};

// "Converted" = the contact has at least one won deal (same definition the
// dashboard's conversion-rate metric uses) - counted as a distinct contact
// even if they've closed more than once, since the ROI question here is
// "did this source produce a client," not "how many deals." Gross
// commission is the raw, uncapped deal amount rather than the
// cap-clamped net figure the commission tracker shows - that figure only
// makes sense walked across every deal together in date order (see
// computeDeals), which is more coupling than a marketing-spend report
// needs; this just answers "which sources bring in the most business."
export async function getLeadSourceReport(): Promise<LeadSourceReportRow[]> {
  const supabase = await createClient();
  const [{ data: contacts }, { data: deals }] = await Promise.all([
    supabase.from("contacts").select("id, lead_source").eq("archived", false),
    supabase.from("deals").select("contact_id, gross_commission").eq("status", "won"),
  ]);

  const sourceByContactId = new Map<string, string>();
  const contactCountBySource = new Map<string, number>();
  for (const c of contacts ?? []) {
    const source = c.lead_source?.trim() || "Unknown";
    sourceByContactId.set(c.id, source);
    contactCountBySource.set(source, (contactCountBySource.get(source) ?? 0) + 1);
  }

  const convertedIdsBySource = new Map<string, Set<string>>();
  const wonDealCountBySource = new Map<string, number>();
  const grossCommissionBySource = new Map<string, number>();
  for (const d of deals ?? []) {
    if (!d.contact_id) continue;
    const source = sourceByContactId.get(d.contact_id) ?? "Unknown";
    const converted = convertedIdsBySource.get(source) ?? new Set<string>();
    converted.add(d.contact_id);
    convertedIdsBySource.set(source, converted);
    wonDealCountBySource.set(source, (wonDealCountBySource.get(source) ?? 0) + 1);
    grossCommissionBySource.set(source, (grossCommissionBySource.get(source) ?? 0) + (d.gross_commission ?? 0));
  }

  const sources = new Set([...contactCountBySource.keys(), ...convertedIdsBySource.keys()]);

  return [...sources]
    .map((source) => {
      const contactCount = contactCountBySource.get(source) ?? 0;
      const convertedCount = convertedIdsBySource.get(source)?.size ?? 0;
      return {
        source,
        contactCount,
        convertedCount,
        conversionRate: contactCount > 0 ? (convertedCount / contactCount) * 100 : 0,
        wonDealCount: wonDealCountBySource.get(source) ?? 0,
        grossCommission: grossCommissionBySource.get(source) ?? 0,
      };
    })
    .sort((a, b) => b.contactCount - a.contactCount);
}

export type CommissionTrendMonth = { key: string; label: string; grossCommission: number; dealCount: number };

// Gross, not net - same tradeoff as getLeadSourceReport (net requires
// walking every deal in a cap year in closing-date order, which only gives
// a correct number across the full history, not a single month in
// isolation).
export async function getCommissionTrend(): Promise<CommissionTrendMonth[]> {
  const supabase = await createClient();
  const months = lastNMonths(6);
  const { data: deals } = await supabase
    .from("deals")
    .select("gross_commission, closed_at")
    .eq("status", "won")
    .gte("closed_at", months[0].start.toISOString());

  return months.map((m) => {
    const inMonth = (deals ?? []).filter((d) => {
      const t = new Date(d.closed_at).getTime();
      return t >= m.start.getTime() && t < m.end.getTime();
    });
    return {
      key: m.key,
      label: m.label,
      grossCommission: inMonth.reduce((sum, d) => sum + (d.gross_commission ?? 0), 0),
      dealCount: inMonth.length,
    };
  });
}

export type DealForecastMonth = { key: string; label: string; grossCommission: number; dealCount: number };
export type DealForecastData = { months: DealForecastMonth[]; otherCount: number; otherGrossCommission: number };

// Pending deals grouped by expected_closing_date - closed_at is the
// fallback (it doubles as the projected close date on a pending deal, same
// as it's the actual close date on a won one). Anything that doesn't land
// in the next 6 months (past-due pending deals included) goes in "other"
// rather than silently vanishing from the total.
export async function getDealForecast(): Promise<DealForecastData> {
  const supabase = await createClient();
  const { data: deals } = await supabase.from("deals").select("gross_commission, expected_closing_date, closed_at").eq("status", "pending");

  const months = nextNMonths(6);
  const monthResults: DealForecastMonth[] = months.map((m) => ({ key: m.key, label: m.label, grossCommission: 0, dealCount: 0 }));
  let otherCount = 0;
  let otherGrossCommission = 0;

  for (const d of deals ?? []) {
    const dateStr = d.expected_closing_date ?? d.closed_at;
    const t = dateStr ? new Date(dateStr).getTime() : NaN;
    const idx = months.findIndex((m) => t >= m.start.getTime() && t < m.end.getTime());
    if (idx === -1) {
      otherCount += 1;
      otherGrossCommission += d.gross_commission ?? 0;
    } else {
      monthResults[idx].dealCount += 1;
      monthResults[idx].grossCommission += d.gross_commission ?? 0;
    }
  }

  return { months: monthResults, otherCount, otherGrossCommission };
}

export type ContactTypeBreakdownRow = { type: string; label: string; count: number };

export async function getContactTypeBreakdown(): Promise<ContactTypeBreakdownRow[]> {
  const supabase = await createClient();
  const { data: contacts } = await supabase.from("contacts").select("relationship_type").eq("archived", false);

  const counts = new Map<string, number>();
  for (const c of contacts ?? []) {
    counts.set(c.relationship_type, (counts.get(c.relationship_type) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: RELATIONSHIP_TYPE_LABELS[type as RelationshipType] ?? type, count }))
    .sort((a, b) => b.count - a.count);
}

export type SpeedToLeadBucket = { label: string; count: number };

// Same activities query shape as speedToLeadFor in lib/data/metrics.ts, so
// this distribution and that average never disagree about what counts as
// "contacted" - it's the same underlying events, just bucketed instead of
// averaged (which hides how much one slow outlier skews the mean).
export async function getSpeedToLeadDistribution(period: Period): Promise<SpeedToLeadBucket[]> {
  const supabase = await createClient();
  const start = daysAgo(PERIOD_DAYS[period]);
  const end = daysAgo(0);

  const { data: newContacts } = await supabase
    .from("contacts")
    .select("id, created_at")
    .eq("archived", false)
    .gte("created_at", start)
    .lt("created_at", end);

  const contactIds = (newContacts ?? []).map((c) => c.id);
  const firstContactByContact = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: outbound } = await supabase
      .from("activities")
      .select("contact_id, occurred_at")
      .in("contact_id", contactIds)
      .eq("direction", "outbound")
      .in("type", ["call", "text", "email"])
      .order("occurred_at", { ascending: true });
    for (const a of outbound ?? []) {
      if (!firstContactByContact.has(a.contact_id)) firstContactByContact.set(a.contact_id, a.occurred_at);
    }
  }

  const buckets = { withinHour: 0, sameDay: 0, withinWeek: 0, longer: 0, never: 0 };
  for (const c of newContacts ?? []) {
    const firstOutbound = firstContactByContact.get(c.id);
    if (!firstOutbound) {
      buckets.never += 1;
      continue;
    }
    const hours = (new Date(firstOutbound).getTime() - new Date(c.created_at).getTime()) / 3_600_000;
    if (hours < 0) buckets.never += 1;
    else if (hours < 1) buckets.withinHour += 1;
    else if (hours < 24) buckets.sameDay += 1;
    else if (hours < 24 * 7) buckets.withinWeek += 1;
    else buckets.longer += 1;
  }

  return [
    { label: "Within 1 hour", count: buckets.withinHour },
    { label: "Same day", count: buckets.sameDay },
    { label: "Within a week", count: buckets.withinWeek },
    { label: "Longer than a week", count: buckets.longer },
    { label: "Never contacted", count: buckets.never },
  ];
}

export type SourceTrendRow = { source: string; monthlyCounts: number[]; total: number };
export type SourceTrendData = { monthLabels: string[]; rows: SourceTrendRow[] };

// Filtered on lead_date, same reasoning as getNewLeadsReport - a backfilled
// CSV contact should show up in the month it actually came in, not the
// month it happened to be imported.
export async function getSourceTrend(): Promise<SourceTrendData> {
  const supabase = await createClient();
  const months = lastNMonths(6);
  const { data: contacts } = await supabase
    .from("contacts")
    .select("lead_source, lead_date")
    .eq("archived", false)
    .gte("lead_date", months[0].start.toISOString());

  const countsBySource = new Map<string, number[]>();
  for (const c of contacts ?? []) {
    const source = c.lead_source?.trim() || "Unknown";
    const t = new Date(c.lead_date).getTime();
    const idx = months.findIndex((m) => t >= m.start.getTime() && t < m.end.getTime());
    if (idx === -1) continue;
    if (!countsBySource.has(source)) countsBySource.set(source, new Array(months.length).fill(0));
    countsBySource.get(source)![idx] += 1;
  }

  const rows = [...countsBySource.entries()]
    .map(([source, monthlyCounts]) => ({ source, monthlyCounts, total: monthlyCounts.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  return { monthLabels: months.map((m) => m.label), rows };
}

export type TagSegmentRow = { tagName: string; color: string; count: number };
export type TagSegmentData = { rows: TagSegmentRow[]; untaggedCount: number };

export async function getTagSegments(): Promise<TagSegmentData> {
  const supabase = await createClient();
  const [{ data: tags }, { data: contactTags }, { data: contacts }] = await Promise.all([
    supabase.from("tags").select("id, name, color"),
    supabase.from("contact_tags").select("contact_id, tag_id"),
    supabase.from("contacts").select("id").eq("archived", false),
  ]);

  const activeContactIds = new Set((contacts ?? []).map((c) => c.id));
  const countByTagId = new Map<string, number>();
  const taggedContactIds = new Set<string>();
  for (const ct of contactTags ?? []) {
    if (!activeContactIds.has(ct.contact_id)) continue;
    countByTagId.set(ct.tag_id, (countByTagId.get(ct.tag_id) ?? 0) + 1);
    taggedContactIds.add(ct.contact_id);
  }

  const rows = (tags ?? [])
    .map((t) => ({ tagName: t.name, color: t.color, count: countByTagId.get(t.id) ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return { rows, untaggedCount: activeContactIds.size - taggedContactIds.size };
}

export type JourneyStageRow = { label: string; count: number };

// Only tells apart the 3 buckets the House Hacking journey question's
// tags actually distinguish (see lib/crm/journey-stage.ts) - "House
// Hacker" alone covers both "looking for my next one" and "not actively
// looking right now" since both answers apply the same tags.
export async function getJourneyStageBreakdown(): Promise<JourneyStageRow[]> {
  const supabase = await createClient();
  const [{ data: tags }, { data: contactTags }, { data: contacts }] = await Promise.all([
    supabase.from("tags").select("id, name"),
    supabase.from("contact_tags").select("contact_id, tag_id"),
    supabase.from("contacts").select("id").eq("archived", false),
  ]);

  const tagIdByName = new Map((tags ?? []).map((t) => [t.name, t.id]));
  const houseHackingId = tagIdByName.get("House Hacking");
  const houseHackerId = tagIdByName.get("House Hacker");
  const firstTimeBuyerId = tagIdByName.get("First-Time Buyer");

  const tagIdsByContact = new Map<string, Set<string>>();
  for (const ct of contactTags ?? []) {
    if (!tagIdsByContact.has(ct.contact_id)) tagIdsByContact.set(ct.contact_id, new Set());
    tagIdsByContact.get(ct.contact_id)!.add(ct.tag_id);
  }

  let researching = 0;
  let firstTime = 0;
  let alreadyHouseHacking = 0;
  for (const c of contacts ?? []) {
    const contactTagIds = tagIdsByContact.get(c.id);
    if (!contactTagIds || !houseHackingId || !contactTagIds.has(houseHackingId)) continue;
    if (houseHackerId && contactTagIds.has(houseHackerId)) alreadyHouseHacking += 1;
    else if (firstTimeBuyerId && contactTagIds.has(firstTimeBuyerId)) firstTime += 1;
    else researching += 1;
  }

  return [
    { label: "Just researching", count: researching },
    { label: "Looking for first house hack", count: firstTime },
    { label: "Already house hacking", count: alreadyHouseHacking },
  ];
}

export type CommissionRateTrendMonth = { key: string; label: string; avgRate: number | null; dealCount: number };

export async function getCommissionRateTrend(): Promise<CommissionRateTrendMonth[]> {
  const supabase = await createClient();
  const months = lastNMonths(6);
  const { data: deals } = await supabase
    .from("deals")
    .select("gross_commission, sale_price, closed_at")
    .eq("status", "won")
    .gte("closed_at", months[0].start.toISOString());

  return months.map((m) => {
    const inMonth = (deals ?? []).filter((d) => {
      const t = new Date(d.closed_at).getTime();
      return t >= m.start.getTime() && t < m.end.getTime();
    });
    const rates = inMonth
      .filter((d) => d.sale_price && d.gross_commission)
      .map((d) => (d.gross_commission! / d.sale_price!) * 100);
    return {
      key: m.key,
      label: m.label,
      avgRate: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      dealCount: inMonth.length,
    };
  });
}

// The original app also had a getCapYearComparison report here, walking
// won deals through a brokerage-specific commission-cap formula
// (lib/crm/commission.ts) - intentionally excluded from this chassis
// (see README). getCommissionTrend/getCommissionRateTrend/getDealForecast
// below stay, since they only use the deal's own gross_commission.

export type TaskTrendMonth = { key: string; label: string; created: number; completed: number };

// "Completed" counts whichever month the task was actually finished in,
// not the month it was created - a task created in April and finished in
// May should show up as May's follow-through, not get lost in April's
// count.
export async function getTaskCompletionTrend(): Promise<TaskTrendMonth[]> {
  const supabase = await createClient();
  const months = lastNMonths(6);
  const { data: tasks } = await supabase
    .from("tasks")
    .select("created_at, completed_at")
    .gte("created_at", months[0].start.toISOString());

  return months.map((m) => {
    const created = (tasks ?? []).filter((t) => {
      const t2 = new Date(t.created_at).getTime();
      return t2 >= m.start.getTime() && t2 < m.end.getTime();
    }).length;
    const completed = (tasks ?? []).filter((t) => {
      if (!t.completed_at) return false;
      const t2 = new Date(t.completed_at).getTime();
      return t2 >= m.start.getTime() && t2 < m.end.getTime();
    }).length;
    return { key: m.key, label: m.label, created, completed };
  });
}

export type StaleLeadBucket = { label: string; minDays: number; count: number };

// "Quiet" is measured from the contact's last logged activity, or their
// lead_date if they have none yet - deliberately independent of
// next_follow_up_at, since this is meant to catch people nobody ever set a
// follow-up date for in the first place, not duplicate the follow-up list.
// Only active-stage contacts count - a Past Client or Trash contact going
// quiet is expected, not a missed lead.
export async function getStaleLeadsReport(): Promise<StaleLeadBucket[]> {
  const supabase = await createClient();
  const [{ data: stages }, { data: contacts }, { data: activities }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, is_closed_won, is_closed_lost, is_trash"),
    supabase.from("contacts").select("id, stage_id, lead_date").eq("archived", false),
    supabase.from("activities").select("contact_id, occurred_at"),
  ]);

  const activeStageIds = new Set(
    (stages ?? []).filter((s) => !s.is_closed_won && !s.is_closed_lost && !s.is_trash).map((s) => s.id),
  );

  const lastActivityByContact = new Map<string, string>();
  for (const a of activities ?? []) {
    const existing = lastActivityByContact.get(a.contact_id);
    if (!existing || new Date(a.occurred_at) > new Date(existing)) lastActivityByContact.set(a.contact_id, a.occurred_at);
  }

  const now = Date.now();
  let d30 = 0;
  let d60 = 0;
  let d90 = 0;
  for (const c of contacts ?? []) {
    if (!c.stage_id || !activeStageIds.has(c.stage_id)) continue;
    const last = lastActivityByContact.get(c.id) ?? c.lead_date;
    const days = (now - new Date(last).getTime()) / (24 * 60 * 60 * 1000);
    if (days >= 90) d90 += 1;
    else if (days >= 60) d60 += 1;
    else if (days >= 30) d30 += 1;
  }

  return [
    { label: "30-59 days quiet", minDays: 30, count: d30 },
    { label: "60-89 days quiet", minDays: 60, count: d60 },
    { label: "90+ days quiet", minDays: 90, count: d90 },
  ];
}

export type DuplicateRiskPair = {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  matchedOn: "email" | "phone";
};

// Exact matches only (same normalization findOrCreateContact/ContactForm
// already use) - anything caught here is a real duplicate that slipped
// past the creation-time warning, not a fuzzy guess. O(n^2) is fine at
// solo-agent scale (hundreds to low thousands of contacts); would need
// rethinking well before that stops being true.
export async function getDuplicateRiskPairs(): Promise<DuplicateRiskPair[]> {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone")
    .eq("archived", false);

  const list = contacts ?? [];
  const pairs: DuplicateRiskPair[] = [];
  const seenPairKeys = new Set<string>();

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const emailMatch = !!(a.email && b.email && a.email.trim().toLowerCase() === b.email.trim().toLowerCase());
      const phoneMatch = !!(a.phone && b.phone && phonesMatch(a.phone, b.phone));
      if (!emailMatch && !phoneMatch) continue;

      const key = [a.id, b.id].sort().join(":");
      if (seenPairKeys.has(key)) continue;
      seenPairKeys.add(key);

      pairs.push({
        aId: a.id,
        aName: `${a.first_name} ${a.last_name}`.trim(),
        bId: b.id,
        bName: `${b.first_name} ${b.last_name}`.trim(),
        matchedOn: emailMatch ? "email" : "phone",
      });
    }
  }

  return pairs;
}

export type SequenceEngagementRow = {
  id: string;
  name: string;
  sentTotal: number;
  openRate: number;
  clickRate: number;
  unsubRate: number;
};

export async function getSequenceEngagementReport(): Promise<SequenceEngagementRow[]> {
  const supabase = await createClient();
  const [{ data: sequences }, { data: sends }] = await Promise.all([
    supabase.from("email_sequences").select("id, name"),
    supabase.from("email_sequence_sends").select("sequence_id, opened_at, clicked_at, unsubscribed_at"),
  ]);

  const statsBySeq = new Map<string, { sent: number; opened: number; clicked: number; unsubscribed: number }>();
  for (const s of sends ?? []) {
    const cur = statsBySeq.get(s.sequence_id) ?? { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    cur.sent += 1;
    if (s.opened_at) cur.opened += 1;
    if (s.clicked_at) cur.clicked += 1;
    if (s.unsubscribed_at) cur.unsubscribed += 1;
    statsBySeq.set(s.sequence_id, cur);
  }

  return (sequences ?? [])
    .map((seq) => {
      const s = statsBySeq.get(seq.id) ?? { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
      return {
        id: seq.id,
        name: seq.name,
        sentTotal: s.sent,
        openRate: s.sent ? (s.opened / s.sent) * 100 : 0,
        clickRate: s.sent ? (s.clicked / s.sent) * 100 : 0,
        unsubRate: s.sent ? (s.unsubscribed / s.sent) * 100 : 0,
      };
    })
    .filter((r) => r.sentTotal > 0)
    .sort((a, b) => b.sentTotal - a.sentTotal);
}

export type StageDistributionRow = { stageName: string; color: string; count: number };

export async function getStageDistribution(): Promise<StageDistributionRow[]> {
  const supabase = await createClient();
  const [{ data: stages }, { data: contacts }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, name, color, sort_order").order("sort_order", { ascending: true }),
    supabase.from("contacts").select("stage_id").eq("archived", false),
  ]);

  const countByStage = new Map<string, number>();
  for (const c of contacts ?? []) {
    if (!c.stage_id) continue;
    countByStage.set(c.stage_id, (countByStage.get(c.stage_id) ?? 0) + 1);
  }

  return (stages ?? []).map((s) => ({ stageName: s.name, color: s.color, count: countByStage.get(s.id) ?? 0 }));
}

export type FollowUpRateTrendMonth = { key: string; label: string; rate: number | null };

// Same relevance filter as followUpRateFor in lib/data/metrics.ts (tasks
// tied to an archived contact don't count), extended to a 6-month trend
// instead of one week/month number.
export async function getFollowUpRateTrend(): Promise<FollowUpRateTrendMonth[]> {
  const supabase = await createClient();
  const months = lastNMonths(6);

  const [{ data: archivedContacts }, { data: tasks }] = await Promise.all([
    supabase.from("contacts").select("id").eq("archived", true),
    supabase.from("tasks").select("contact_id, due_at, completed_at").gte("due_at", months[0].start.toISOString()),
  ]);
  const archivedIds = new Set((archivedContacts ?? []).map((c) => c.id));

  return months.map((m) => {
    const relevant = (tasks ?? []).filter((t) => {
      if (!t.due_at) return false;
      const t2 = new Date(t.due_at).getTime();
      const inRange = t2 >= m.start.getTime() && t2 < m.end.getTime();
      const notArchived = !t.contact_id || !archivedIds.has(t.contact_id);
      return inRange && notArchived;
    });
    if (relevant.length === 0) return { key: m.key, label: m.label, rate: null };
    const completed = relevant.filter((t) => t.completed_at).length;
    return { key: m.key, label: m.label, rate: (completed / relevant.length) * 100 };
  });
}

export type EngagementBucket = { label: string; count: number };

// All-time, across every sequence a contact has ever received mail from -
// not scoped to current enrollment, since "has this person ever engaged
// with an email from us" is the useful question here, not just their
// current sequence.
export async function getLeadEngagementBreakdown(): Promise<EngagementBucket[]> {
  const supabase = await createClient();
  const { data: sends } = await supabase.from("email_sequence_sends").select("contact_id, opened_at, clicked_at");

  const byContact = new Map<string, { opened: boolean; clicked: boolean }>();
  for (const s of sends ?? []) {
    const cur = byContact.get(s.contact_id) ?? { opened: false, clicked: false };
    if (s.opened_at) cur.opened = true;
    if (s.clicked_at) cur.clicked = true;
    byContact.set(s.contact_id, cur);
  }

  let never = 0;
  let openedOnly = 0;
  let clicked = 0;
  for (const v of byContact.values()) {
    if (v.clicked) clicked += 1;
    else if (v.opened) openedOnly += 1;
    else never += 1;
  }

  return [
    { label: "Never opened", count: never },
    { label: "Opened, never clicked", count: openedOnly },
    { label: "Clicked at least once", count: clicked },
  ];
}
