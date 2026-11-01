import { toZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { localMonthStart, type ScorecardPeriod } from "@/lib/crm/scorecard-period";

export { SCORECARD_PERIOD_LABELS, parseScorecardPeriod, type ScorecardPeriod } from "@/lib/crm/scorecard-period";
import { APP_TIMEZONE } from "@/lib/format-time";

// Headline numbers for the Today scorecard and the Reports trends:
// how many people became Clients, and how texting / email outreach is
// landing. Everything is computed from data the CRM already records:
//   - contacts.client_converted_at / _from (set by a DB trigger)
//   - text activities (Quo) and contacts.opted_out_at
//   - email_sequence_sends (campaign emails: opens, clicks, unsubscribes)

export function periodRange(period: ScorecardPeriod, now = new Date()): { start: Date; end: Date } {
  const local = toZonedTime(now, APP_TIMEZONE);
  const y = local.getFullYear();
  const m = local.getMonth();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  switch (period) {
    case "7d":
      return { start: daysAgo(7), end: now };
    case "30d":
      return { start: daysAgo(30), end: now };
    case "90d":
      return { start: daysAgo(90), end: now };
    case "this_month":
      return { start: localMonthStart(y, m), end: now };
    case "last_month":
      return { start: localMonthStart(y, m - 1), end: localMonthStart(y, m) };
    case "year":
      return { start: localMonthStart(y, 0), end: now };
  }
}

export type ConversionStats = {
  fromProspect: number;
  fromCommunity: number;
  total: number;
  // Of everyone who was a Prospect (converted in the period + still a
  // Prospect now), the share who became a Client. Same for Community.
  prospectRate: number | null;
  communityRate: number | null;
};

export type TextStats = { texted: number; replied: number; optedOut: number; replyRate: number | null; optOutRate: number | null };

export type EmailStats = {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  openRate: number | null;
  clickRate: number | null;
  replyRate: number | null;
  unsubscribeRate: number | null;
};

export type Scorecard = { conversion: ConversionStats; texts: TextStats; emails: EmailStats };

type ConversionRow = { client_converted_at: string; client_converted_from: string | null };
type ActivityRow = { contact_id: string; direction: string; occurred_at: string };
type OptOutRow = { id: string; opted_out_at: string };
type SendRow = { contact_id: string; sent_at: string; opened_at: string | null; clicked_at: string | null; unsubscribed_at: string | null };

export type Raw = {
  conversions: ConversionRow[];
  currentProspects: number;
  currentCommunity: number;
  texts: ActivityRow[];
  inboundEmails: ActivityRow[];
  optOuts: OptOutRow[];
  sends: SendRow[];
};

const PAGE = 1000;

// Supabase caps a select at 1000 rows; page through so totals are real.
async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function loadRaw(start: Date, end: Date): Promise<Raw> {
  const supabase = await createClient();
  const s = start.toISOString();
  const e = end.toISOString();
  // Replies can land after the period ends (a text on the 30th answered on
  // the 2nd still counts as a reply to that outreach), so inbound activity
  // is read through now.
  const now = new Date().toISOString();

  const [conversions, prospects, community, texts, inboundEmails, optOuts, sends] = await Promise.all([
    fetchAll<ConversionRow>((f, t) =>
      supabase.from("contacts").select("client_converted_at, client_converted_from").gte("client_converted_at", s).lt("client_converted_at", e).range(f, t),
    ),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("archived", false).eq("relationship_type", "prospect"),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("archived", false).eq("relationship_type", "community"),
    fetchAll<ActivityRow>((f, t) =>
      supabase.from("activities").select("contact_id, direction, occurred_at").eq("type", "text").gte("occurred_at", s).lt("occurred_at", now).order("occurred_at").range(f, t),
    ),
    fetchAll<ActivityRow>((f, t) =>
      supabase.from("activities").select("contact_id, direction, occurred_at").eq("type", "email").eq("direction", "inbound").gte("occurred_at", s).lt("occurred_at", now).range(f, t),
    ),
    fetchAll<OptOutRow>((f, t) => supabase.from("contacts").select("id, opted_out_at").gte("opted_out_at", s).lt("opted_out_at", e).range(f, t)),
    fetchAll<SendRow>((f, t) =>
      supabase.from("email_sequence_sends").select("contact_id, sent_at, opened_at, clicked_at, unsubscribed_at").gte("sent_at", s).lt("sent_at", e).range(f, t),
    ),
  ]);
  if (prospects.error) throw new Error(prospects.error.message);
  if (community.error) throw new Error(community.error.message);

  return {
    conversions,
    currentProspects: prospects.count ?? 0,
    currentCommunity: community.count ?? 0,
    texts,
    inboundEmails,
    optOuts,
    sends,
  };
}

const rate = (n: number, d: number) => (d > 0 ? n / d : null);
const inRange = (iso: string, start: Date, end: Date) => {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
};

export function summarize(raw: Raw, start: Date, end: Date): Scorecard {
  const conversions = raw.conversions.filter((c) => inRange(c.client_converted_at, start, end));
  const fromProspect = conversions.filter((c) => c.client_converted_from === "prospect").length;
  const fromCommunity = conversions.filter((c) => c.client_converted_from === "community").length;

  // Texts: people sent at least one text in the period; replied = they
  // texted back after our first text to them in the period.
  const firstOutbound = new Map<string, number>();
  for (const a of raw.texts) {
    if (a.direction !== "outbound" || !inRange(a.occurred_at, start, end)) continue;
    const t = new Date(a.occurred_at).getTime();
    if (!firstOutbound.has(a.contact_id) || t < firstOutbound.get(a.contact_id)!) firstOutbound.set(a.contact_id, t);
  }
  const textReplied = new Set<string>();
  for (const a of raw.texts) {
    const first = firstOutbound.get(a.contact_id);
    if (a.direction === "inbound" && first != null && new Date(a.occurred_at).getTime() > first) textReplied.add(a.contact_id);
  }
  const optedOut = raw.optOuts.filter((o) => firstOutbound.has(o.id) && inRange(o.opted_out_at, start, end)).length;

  // Campaign emails sent in the period. Replied = an inbound email from that
  // contact after the send.
  const sends = raw.sends.filter((x) => inRange(x.sent_at, start, end));
  const firstSend = new Map<string, number>();
  for (const x of sends) {
    const t = new Date(x.sent_at).getTime();
    if (!firstSend.has(x.contact_id) || t < firstSend.get(x.contact_id)!) firstSend.set(x.contact_id, t);
  }
  const emailReplied = new Set<string>();
  for (const a of raw.inboundEmails) {
    const first = firstSend.get(a.contact_id);
    if (first != null && new Date(a.occurred_at).getTime() > first) emailReplied.add(a.contact_id);
  }
  const opened = sends.filter((x) => x.opened_at).length;
  const clicked = sends.filter((x) => x.clicked_at).length;
  const unsubscribed = sends.filter((x) => x.unsubscribed_at).length;

  return {
    conversion: {
      fromProspect,
      fromCommunity,
      total: conversions.length,
      prospectRate: rate(fromProspect, fromProspect + raw.currentProspects),
      communityRate: rate(fromCommunity, fromCommunity + raw.currentCommunity),
    },
    texts: {
      texted: firstOutbound.size,
      replied: textReplied.size,
      optedOut,
      replyRate: rate(textReplied.size, firstOutbound.size),
      optOutRate: rate(optedOut, firstOutbound.size),
    },
    emails: {
      sent: sends.length,
      opened,
      clicked,
      replied: emailReplied.size,
      unsubscribed,
      openRate: rate(opened, sends.length),
      clickRate: rate(clicked, sends.length),
      replyRate: rate(emailReplied.size, firstSend.size),
      unsubscribeRate: rate(unsubscribed, sends.length),
    },
  };
}

export async function getScorecard(period: ScorecardPeriod): Promise<Scorecard> {
  const { start, end } = periodRange(period);
  return summarize(await loadRaw(start, end), start, end);
}

export type MonthlyScorecard = { month: string; monthIndex: number; future: boolean; scorecard: Scorecard };

// Jan-Dec of the current year, one Scorecard per month (future months are
// flagged so charts can stop the line at the current month).
export async function getYearScorecard(now = new Date()): Promise<MonthlyScorecard[]> {
  const year = toZonedTime(now, APP_TIMEZONE).getFullYear();
  const currentMonth = toZonedTime(now, APP_TIMEZONE).getMonth();
  const raw = await loadRaw(localMonthStart(year, 0), now);
  return Array.from({ length: 12 }, (_, i) => {
    const start = localMonthStart(year, i);
    const end = i === currentMonth ? now : localMonthStart(year, i + 1);
    return {
      month: new Date(2000, i, 1).toLocaleString("en-US", { month: "short" }),
      monthIndex: i,
      future: i > currentMonth,
      scorecard: summarize(raw, start, end),
    };
  });
}
