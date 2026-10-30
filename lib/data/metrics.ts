import { createClient } from "@/lib/supabase/server";
import type { MetricGoal, MetricKey } from "@/types/database";

export type Period = "week" | "month";

export type MetricResult = {
  current: number | null;
  previous: number | null;
  improved: boolean | null;
  goal: number | null;
  meetsGoal: boolean | null;
};

export type Metrics = {
  speedToLead: MetricResult; // hours, lower is better
  contactedPct: MetricResult; // %, higher is better
  followUpRate: MetricResult; // %, higher is better
  conversionRate: MetricResult; // %, higher is better
};

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30 };
const CONTACTED_TYPES = ["call", "text", "email", "note", "meeting", "showing"];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function speedToLeadFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: string,
  end: string,
): Promise<number | null> {
  const { data: newContacts } = await supabase
    .from("contacts")
    .select("id, created_at")
    .eq("archived", false)
    .gte("created_at", start)
    .lt("created_at", end);

  const contactIds = (newContacts ?? []).map((c) => c.id);
  if (contactIds.length === 0) return null;

  const { data: outbound } = await supabase
    .from("activities")
    .select("contact_id, occurred_at")
    .in("contact_id", contactIds)
    .eq("direction", "outbound")
    .in("type", ["call", "text", "email"])
    .order("occurred_at", { ascending: true });

  const firstContactByContact = new Map<string, string>();
  for (const a of outbound ?? []) {
    if (!firstContactByContact.has(a.contact_id)) firstContactByContact.set(a.contact_id, a.occurred_at);
  }

  const hoursDiffs: number[] = [];
  for (const c of newContacts ?? []) {
    const firstOutbound = firstContactByContact.get(c.id);
    if (!firstOutbound) continue;
    const hours = (new Date(firstOutbound).getTime() - new Date(c.created_at).getTime()) / 3_600_000;
    if (hours >= 0) hoursDiffs.push(hours);
  }

  if (hoursDiffs.length === 0) return null;
  return hoursDiffs.reduce((sum, h) => sum + h, 0) / hoursDiffs.length;
}

async function contactedPctFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  activeStageIds: Set<string>,
  start: string,
  end: string,
): Promise<number | null> {
  const { data: contacts } = await supabase.from("contacts").select("id, stage_id").eq("archived", false);
  const activeContactIds = (contacts ?? []).filter((c) => c.stage_id && activeStageIds.has(c.stage_id)).map((c) => c.id);
  if (activeContactIds.length === 0) return null;

  const { data: activities } = await supabase
    .from("activities")
    .select("contact_id")
    .in("contact_id", activeContactIds)
    .in("type", CONTACTED_TYPES)
    .gte("occurred_at", start)
    .lt("occurred_at", end);

  const contactedIds = new Set((activities ?? []).map((a) => a.contact_id));
  return (contactedIds.size / activeContactIds.length) * 100;
}

async function followUpRateFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: string,
  end: string,
): Promise<number | null> {
  // Tasks tied to an archived contact (mostly trashed non-leads) shouldn't
  // drag this down; general tasks with no contact still count.
  const { data: archivedContacts } = await supabase.from("contacts").select("id").eq("archived", true);
  const archivedIds = new Set((archivedContacts ?? []).map((c) => c.id));

  const { data: tasks } = await supabase
    .from("tasks")
    .select("contact_id, completed_at")
    .gte("due_at", start)
    .lt("due_at", end);

  const relevant = (tasks ?? []).filter((t) => !t.contact_id || !archivedIds.has(t.contact_id));
  if (relevant.length === 0) return null;
  const completed = relevant.filter((t) => t.completed_at).length;
  return (completed / relevant.length) * 100;
}

// Conversion is tracked via the append-only `deals` table rather than a
// contact's current stage_id, since an investor who closes and then goes
// back to actively shopping for the next property shouldn't stop counting
// as converted just because they've moved off the Won stage.
async function conversionRateFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: string,
  end: string,
): Promise<number | null> {
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("archived", false)
    .gte("created_at", start)
    .lt("created_at", end);

  if (!contacts || contacts.length === 0) return null;

  const contactIds = contacts.map((c) => c.id);
  const { data: deals } = await supabase
    .from("deals")
    .select("contact_id")
    .eq("status", "won")
    .in("contact_id", contactIds);
  const wonIds = new Set((deals ?? []).map((d) => d.contact_id));

  return (wonIds.size / contacts.length) * 100;
}

export async function getMetrics(period: Period): Promise<Metrics> {
  const supabase = await createClient();
  const days = PERIOD_DAYS[period];

  const currentStart = daysAgo(days);
  const currentEnd = daysAgo(0);
  const previousStart = daysAgo(days * 2);
  const previousEnd = currentStart;

  const [{ data: stages }, { data: goalRows }] = await Promise.all([
    supabase.from("pipeline_stages").select("id, is_closed_won, is_closed_lost, is_trash"),
    supabase.from("metric_goals").select("*"),
  ]);
  const goalByKey = new Map<MetricKey, MetricGoal>((goalRows ?? []).map((g) => [g.metric_key as MetricKey, g]));

  const activeStageIds = new Set(
    (stages ?? []).filter((s) => !s.is_closed_won && !s.is_closed_lost && !s.is_trash).map((s) => s.id),
  );

  const [
    speedCurrent,
    speedPrevious,
    contactedCurrent,
    contactedPrevious,
    followUpCurrent,
    followUpPrevious,
    conversionCurrent,
    conversionPrevious,
  ] = await Promise.all([
    speedToLeadFor(supabase, currentStart, currentEnd),
    speedToLeadFor(supabase, previousStart, previousEnd),
    contactedPctFor(supabase, activeStageIds, currentStart, currentEnd),
    contactedPctFor(supabase, activeStageIds, previousStart, previousEnd),
    followUpRateFor(supabase, currentStart, currentEnd),
    followUpRateFor(supabase, previousStart, previousEnd),
    conversionRateFor(supabase, currentStart, currentEnd),
    conversionRateFor(supabase, previousStart, previousEnd),
  ]);

  function build(current: number | null, previous: number | null, key: MetricKey, lowerIsBetter: boolean): MetricResult {
    const goal = goalByKey.get(key)?.target_value ?? null;
    const improved =
      current == null || previous == null
        ? null
        : lowerIsBetter
          ? current < previous
          : current > previous;
    const meetsGoal =
      current == null || goal == null ? null : lowerIsBetter ? current <= goal : current >= goal;
    return { current, previous, improved, goal, meetsGoal };
  }

  return {
    speedToLead: build(speedCurrent, speedPrevious, "speed_to_lead", true),
    contactedPct: build(contactedCurrent, contactedPrevious, "contacted_pct", false),
    followUpRate: build(followUpCurrent, followUpPrevious, "follow_up_rate", false),
    conversionRate: build(conversionCurrent, conversionPrevious, "conversion_rate", false),
  };
}
