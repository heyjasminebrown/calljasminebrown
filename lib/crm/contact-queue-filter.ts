import { createClient } from "@/lib/supabase/server";
import { computeLikelihood } from "@/lib/crm/likelihood";
import { getDuplicateRiskPairs } from "@/lib/data/reports";
import { hasUsablePhone, isAnyOutreach, isOutboundOutreach } from "@/lib/crm/contact-filter-predicates";
import type { ContactQueue } from "@/lib/crm/contact-queues";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

// A vendor or referral partner who registers for a meetup (as a sponsor,
// or just personally) was never a sales lead to begin with - flagging
// them as "gone cold" alongside actual buyers/sellers/investors is
// noise, not signal. Scoped narrowly to the three event-driven queues
// below (all three ask "did the funnel stall after this registration"),
// not the cold-calling queues further down, where the question is
// different.
const NON_LEAD_CONTACT_TYPES = new Set(["vendor", "referral_partner"]);

const QUIET_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;
// Registering for an event and the event itself aren't the same moment,
// and we don't reliably know the event's date (only when they registered) -
// this buffer avoids flagging someone as a "no-show" the day after they
// signed up, before the event they registered for has even happened yet.
const NO_SHOW_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

type ActivityAgg = {
  lastOutreachAt: number | null;
  lastOutboundAt: number | null;
  lastCallAt: number | null;
  lastEventbriteAt: number | null;
  jotformCheckinCount: number;
};

async function fetchActivityAggregates(): Promise<Map<string, ActivityAgg>> {
  const supabase = await createClient();
  const { data } = await supabase.from("activities").select("contact_id, type, source, direction, occurred_at");

  const map = new Map<string, ActivityAgg>();
  for (const row of data ?? []) {
    const entry = map.get(row.contact_id as string) ?? {
      lastOutreachAt: null,
      lastOutboundAt: null,
      lastCallAt: null,
      lastEventbriteAt: null,
      jotformCheckinCount: 0,
    };
    const t = new Date(row.occurred_at as string).getTime();

    if (isAnyOutreach(row)) {
      if (entry.lastOutreachAt === null || t > entry.lastOutreachAt) entry.lastOutreachAt = t;
    }
    if (isOutboundOutreach(row)) {
      if (entry.lastOutboundAt === null || t > entry.lastOutboundAt) entry.lastOutboundAt = t;
    }
    if (row.type === "call" && (entry.lastCallAt === null || t > entry.lastCallAt)) entry.lastCallAt = t;
    if (row.source === "eventbrite" && (entry.lastEventbriteAt === null || t > entry.lastEventbriteAt)) entry.lastEventbriteAt = t;
    if (row.source === "checkin" || row.source === "jotform") entry.jotformCheckinCount++;

    map.set(row.contact_id as string, entry);
  }
  return map;
}

export async function filterByQueue(
  contacts: ContactWithRelations[],
  queue: ContactQueue,
  stages: PipelineStage[],
): Promise<ContactWithRelations[]> {
  const now = Date.now();

  if (queue === "ai_flagged") {
    const supabase = await createClient();
    const { data } = await supabase.from("ai_insights").select("contact_id").eq("dismissed", false);
    const flagged = new Set((data ?? []).map((r) => r.contact_id as string));
    return contacts.filter((c) => flagged.has(c.id));
  }

  if (queue === "no_phone") {
    return contacts.filter((c) => !hasUsablePhone(c.phone));
  }

  if (queue === "duplicate_risk") {
    const pairs = await getDuplicateRiskPairs();
    const flagged = new Set(pairs.flatMap((p) => [p.aId, p.bId]));
    return contacts.filter((c) => flagged.has(c.id));
  }

  const agg = await fetchActivityAggregates();

  if (queue === "no_followup_after_registration") {
    // "No action needed for this one" (a vendor re-registering, a plus-one
    // who isn't a real lead) - dismissed_insights keyed per-contact, same
    // table Insights/Sphere already use. No fixed expiry window: a
    // dismissal only counts while it's newer than the registration that
    // triggered it, so a genuinely new registration later naturally
    // reopens the reminder instead of staying silenced for N days.
    const supabase = await createClient();
    const { data: dismissals } = await supabase
      .from("dismissed_insights")
      .select("contact_id, dismissed_at")
      .eq("insight_key", "registered_no_followup")
      .not("contact_id", "is", null);
    const dismissedAt = new Map((dismissals ?? []).map((d) => [d.contact_id as string, new Date(d.dismissed_at as string).getTime()]));

    return contacts.filter((c) => {
      if (NON_LEAD_CONTACT_TYPES.has(c.contact_type)) return false;
      const a = agg.get(c.id);
      if (!a?.lastEventbriteAt) return false;
      const dismissed = dismissedAt.get(c.id);
      if (dismissed !== undefined && dismissed >= a.lastEventbriteAt) return false;
      return a.lastOutboundAt === null || a.lastOutboundAt < a.lastEventbriteAt;
    });
  }

  if (queue === "no_show") {
    return contacts.filter((c) => {
      if (NON_LEAD_CONTACT_TYPES.has(c.contact_type)) return false;
      const a = agg.get(c.id);
      if (!a?.lastEventbriteAt || c.last_event_at) return false;
      return a.lastEventbriteAt < now - NO_SHOW_GRACE_MS;
    });
  }

  if (queue === "attended_gone_quiet") {
    return contacts.filter((c) => {
      if (NON_LEAD_CONTACT_TYPES.has(c.contact_type)) return false;
      if (!c.last_event_at) return false;
      const lastOutboundAt = agg.get(c.id)?.lastOutboundAt ?? null;
      const lastAttendedAt = new Date(c.last_event_at).getTime();
      return lastOutboundAt === null || lastOutboundAt < lastAttendedAt;
    });
  }

  if (queue === "cold_from_hot") {
    return contacts.filter((c) => {
      if (computeLikelihood(c, stages) !== "high") return false;
      // Only flag leads old enough to plausibly have gone cold - otherwise
      // a brand-new hot lead with no activity yet (normal, hasn't been
      // called back yet) would get miscategorized as "went cold".
      if (new Date(c.lead_date).getTime() > now - QUIET_THRESHOLD_MS) return false;
      const lastOutboundAt = agg.get(c.id)?.lastOutboundAt ?? null;
      return lastOutboundAt === null || lastOutboundAt < now - QUIET_THRESHOLD_MS;
    });
  }

  if (queue === "never_called") {
    return contacts.filter((c) => agg.get(c.id)?.lastCallAt == null);
  }

  if (queue === "no_contact") {
    return contacts.filter((c) => agg.get(c.id)?.lastOutreachAt == null);
  }

  if (queue === "repeat_attendees") {
    return contacts.filter((c) => (agg.get(c.id)?.jotformCheckinCount ?? 0) >= 2);
  }

  return contacts;
}
