import type { SupabaseClient } from "@supabase/supabase-js";
import { fullName } from "@/lib/utils";
import { generateWorthAskingQuestions } from "@/lib/crm/prep-sheet-questions";
import type { UpcomingCalendarEvent } from "@/lib/google/calendar";
import type { Activity } from "@/types/database";

export type PrepSheetPayload = {
  eventId: string;
  eventTitle: string;
  startAt: string;
  location: string | null;
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  sinceLastSpoke: string;
  whatTheyreAfter: { label: string; value: string }[];
  notes: string | null;
  recentActivity: { date: string; label: string }[];
  timelineActivities: Activity[];
  openTasks: { title: string; dueAt: string | null }[];
  lastQuote: { address: string; monthlyOutOfPocket: number; ratePct: number } | null;
  worthAsking: string[];
  totalActivityCount: number;
  firstActivityAt: string | null;
};

const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "1_3_months": "1-3 months",
  "3_6_months": "3-6 months",
  "6_12_months": "6-12 months",
  "12_plus_months": "12+ months",
  just_browsing: "Just browsing",
  unknown: "Unknown",
};

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  if (min && max) return `${fmt(min)}-${fmt(max)}`;
  return fmt(min ?? max!);
}

// Runs against the passed-in admin client only - same lesson as Stop 7's
// weekly review, this fires from a cron with no logged-in session.
export async function buildPrepSheet(
  admin: SupabaseClient,
  ownerId: string,
  event: UpcomingCalendarEvent,
  contactId: string,
): Promise<PrepSheetPayload | null> {
  const { data: contact } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, budget_min, budget_max, timeline, areas_of_interest, representing, notes, last_event_name, last_event_at")
    .eq("id", contactId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!contact) return null;

  // Uncapped - "Everything, in order" needs the true full history (count
  // and earliest date included), not just the most-recent slice the old
  // 8-row cap used for the email digest still uses via recentActivity.
  const [{ data: activities }, { data: openTasks }, { data: lastQuote }] = await Promise.all([
    admin
      .from("activities")
      .select("id, type, direction, occurred_at, body, source, metadata")
      .eq("owner_id", ownerId)
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false }),
    admin
      .from("tasks")
      .select("title, due_at")
      .eq("owner_id", ownerId)
      .eq("contact_id", contactId)
      .is("completed_at", null)
      .order("due_at", { ascending: true, nullsFirst: false }),
    admin
      .from("quotes")
      .select("property_address, monthly_out_of_pocket, interest_rate_pct")
      .eq("owner_id", ownerId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lastOutreach = (activities ?? []).find((a) => ["call", "text", "email"].includes(a.type));
  const daysQuiet = lastOutreach ? Math.floor((Date.now() - new Date(lastOutreach.occurred_at).getTime()) / (24 * 60 * 60 * 1000)) : null;

  const sinceLastSpokeParts = [
    daysQuiet !== null ? `Quiet for ${daysQuiet} day${daysQuiet === 1 ? "" : "s"}` : "No calls, texts, or emails logged yet",
    contact.last_event_name && contact.last_event_at
      ? `attended ${contact.last_event_name} on ${new Date(contact.last_event_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : null,
  ].filter(Boolean);

  const budget = formatBudget(contact.budget_min, contact.budget_max);
  const whatTheyreAfter = [
    budget ? { label: "Budget", value: budget } : null,
    contact.timeline ? { label: "Timeline", value: TIMELINE_LABELS[contact.timeline] ?? contact.timeline } : null,
    contact.areas_of_interest && contact.areas_of_interest.length > 0 ? { label: "Areas", value: contact.areas_of_interest.join(", ") } : null,
    contact.representing ? { label: "Representing", value: contact.representing === "both" ? "Buyer & seller" : contact.representing } : null,
  ].filter((v): v is { label: string; value: string } => !!v);

  const activityLabel = (a: { type: string; direction: string; body: string | null }) => {
    if (a.type === "call") return "Call";
    if (a.type === "text") return a.direction === "inbound" ? "Text from them" : "Text sent";
    if (a.type === "email") return a.direction === "inbound" ? "Email from them" : "Email sent";
    if (a.type === "status_change") return a.body ?? "Stage updated";
    if (a.type === "checkin") return "Checked in at an event";
    return a.body ?? a.type;
  };

  return {
    eventId: event.id,
    eventTitle: event.title,
    startAt: event.startAt,
    location: event.location,
    contactId: contact.id,
    contactName: fullName(contact),
    contactPhone: contact.phone,
    sinceLastSpoke: sinceLastSpokeParts.length > 0 ? `${sinceLastSpokeParts.join(", and ")}.` : "",
    whatTheyreAfter,
    notes: contact.notes,
    recentActivity: (activities ?? []).slice(0, 8).map((a) => ({ date: a.occurred_at, label: activityLabel(a) })),
    timelineActivities: (activities ?? []) as Activity[],
    openTasks: (openTasks ?? []).map((t) => ({ title: t.title, dueAt: t.due_at })),
    lastQuote: lastQuote
      ? { address: lastQuote.property_address, monthlyOutOfPocket: lastQuote.monthly_out_of_pocket, ratePct: lastQuote.interest_rate_pct }
      : null,
    worthAsking: generateWorthAskingQuestions({
      budgetMin: contact.budget_min,
      budgetMax: contact.budget_max,
      timeline: contact.timeline,
      areasOfInterest: contact.areas_of_interest,
      representing: contact.representing,
      notes: contact.notes,
    }),
    totalActivityCount: (activities ?? []).length,
    firstActivityAt: (activities ?? []).length > 0 ? activities![activities!.length - 1].occurred_at : null,
  };
}
