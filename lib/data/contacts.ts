import { createClient } from "@/lib/supabase/server";
import { computeLikelihood } from "@/lib/crm/likelihood";
import { filterByQueue } from "@/lib/crm/contact-queue-filter";
import { relativeTime } from "@/lib/format-time";
import {
  EVENT_ATTENDANCE_SOURCES,
  EVENT_REGISTRATION_SOURCE,
  attendedContactIds,
  eventNameFromMetadata,
  hasUsablePhone,
  registeredContactIds,
} from "@/lib/crm/contact-filter-predicates";
import { contactMatchesGender } from "@/lib/crm/contact-gender";
import { leadSourceMatches } from "@/lib/crm/contact-sources";
import { lastTouchIsOlderThan, membershipIdsFromFilters } from "@/lib/crm/smart-lists";
import type { ContactQueue } from "@/lib/crm/contact-queues";
import type { Activity, AiInsight, ContactSegment, ContactWithRelations, Deal, PipelineStage, Tag, Task } from "@/types/database";

// Per-contact "called 2 hours ago" / "texted yesterday" / "emailed last
// week" meta for the Contacts row - scoped to just the contacts already
// being displayed (unlike contact-queue-filter's unscoped aggregates,
// which need every contact's activity to compute a queue membership) so
// this stays a cheap, targeted query rather than a full-table scan. Any
// channel counts here, not just calls - texted() covers Instagram DMs
// too, since those are logged with type "text" (see instagram-messages.ts).
export async function getLastTouchAts(contactIds: string[]): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("contact_id, occurred_at")
    .in("contact_id", contactIds)
    .in("type", ["call", "text", "email"])
    .order("occurred_at", { ascending: false });

  const timestamps = new Map<string, string>();
  for (const row of data ?? []) {
    if (timestamps.has(row.contact_id)) continue;
    timestamps.set(row.contact_id, row.occurred_at);
  }
  return timestamps;
}

export async function getLastActivityLabels(contactIds: string[]): Promise<Map<string, string>> {
  if (contactIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("contact_id, type, occurred_at")
    .in("contact_id", contactIds)
    .in("type", ["call", "text", "email"])
    .order("occurred_at", { ascending: false });

  const VERBS: Record<string, string> = { call: "called", text: "texted", email: "emailed" };
  const labels = new Map<string, string>();
  for (const row of data ?? []) {
    if (labels.has(row.contact_id)) continue;
    const verb = VERBS[row.type] ?? row.type;
    labels.set(row.contact_id, `${verb} ${relativeTime(row.occurred_at)}`);
  }
  return labels;
}

export async function listStages() {
  const supabase = await createClient();
  const { data } = await supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true });
  return (data ?? []) as PipelineStage[];
}

export async function listTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name", { ascending: true });
  return (data ?? []) as Tag[];
}

export type MergeCandidate = { id: string; first_name: string; last_name: string; phone: string | null; email: string | null };

// Lightweight list for the "merge into…" picker - every non-archived
// contact, not just the current filtered view, so a duplicate can be
// merged into its match regardless of what filters happen to be active.
export async function listMergeCandidates(): Promise<MergeCandidate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, email")
    .eq("archived", false)
    .order("first_name", { ascending: true });
  return (data ?? []) as MergeCandidate[];
}

export type ContactSort =
  | "updated_desc"
  | "created_desc"
  | "created_asc"
  | "lead_date_desc"
  | "lead_date_asc"
  | "name_asc"
  | "name_desc"
  | "follow_up_asc"
  | "tag_asc"
  | "likelihood_desc";

export type ContactListFilters = {
  q?: string;
  stageId?: string;
  tagIds?: string[];
  type?: string;
  timeline?: string;
  representing?: string;
  leadSource?: string;
  stageIds?: string[];
  gender?: "women" | "men" | "unknown";
  hasPhone?: boolean;
  missingPhone?: boolean;
  hasEmail?: boolean;
  missingEmail?: boolean;
  hasFollowUp?: boolean;
  missingFollowUp?: boolean;
  overdueFollowUp?: boolean;
  archived?: "active" | "archived" | "all";
  hasNotes?: boolean;
  missingNotes?: boolean;
  birthdayMonth?: number;
  city?: string;
  state?: string;
  minBudget?: number;
  notSyncedQuo?: boolean;
  // Attended: Jotform/QR check-in for this event (any occurrence), not only
  // last_event_name — attending a later meetup must not hide the earlier one.
  eventName?: string;
  // Registered for: Eventbrite/CRM signup. Sentinel REGISTERED_FOR_ANY_EVENT
  // ("__any__") means any signup; a specific title means that event.
  // Call-only Other / inbound-call stubs never match — they have no
  // eventbrite activity. contact_type=attendee is a label, not this filter.
  registeredEventName?: string;
  likelihood?: "high" | "medium" | "low";
  queue?: ContactQueue;
  // Drill-down from the dashboard's New Leads tile - contacts whose
  // lead_date falls within the last N days, not created_at (see lead_date's
  // comment in the migration for why those can differ).
  leadDateWithinDays?: number;
  leadDateFrom?: string;
  leadDateTo?: string;
  sort?: ContactSort;
  includeIds?: string[];
  lastTouchOlderThanDays?: number;
  inListIds?: string[];
};

export async function listContacts(filters: ContactListFilters) {
  const supabase = await createClient();
  // Spam-flagged auto-created contacts never belong in the People list under
  // any archived filter - they're a separate bucket (see migration 0066),
  // not a kind of lead to browse to, archived or otherwise.
  let query = supabase.from("contacts").select("*, pipeline_stages(*), contact_tags(tags(*))").eq("spam", false);

  if (filters.archived === "archived") query = query.eq("archived", true);
  else if (filters.archived === "all") {
    /* no archived filter at all */
  } else query = query.eq("archived", false);

  if (filters.stageIds?.length) {
    query = filters.stageIds.length === 1 ? query.eq("stage_id", filters.stageIds[0]) : query.in("stage_id", filters.stageIds);
  } else if (filters.stageId) {
    query = query.eq("stage_id", filters.stageId);
  }
  if (filters.type) query = query.eq("contact_type", filters.type);
  if (filters.timeline) query = query.eq("timeline", filters.timeline);
  if (filters.representing) query = query.eq("representing", filters.representing);
  // Source buckets are matched in JS — lead_source is free text.
  if (filters.hasPhone) query = query.not("phone", "is", null);
  // Empty-string phones are not "missing" at SQL null-check time; JS
  // hasUsablePhone below is the real predicate so "" counts as no phone.
  if (filters.hasEmail) query = query.not("email", "is", null);
  if (filters.missingEmail) query = query.is("email", null);
  if (filters.hasFollowUp) query = query.not("next_follow_up_at", "is", null);
  if (filters.missingFollowUp) query = query.is("next_follow_up_at", null);
  if (filters.overdueFollowUp) query = query.not("next_follow_up_at", "is", null).lt("next_follow_up_at", new Date().toISOString());
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.state) query = query.ilike("state", `%${filters.state}%`);
  if (filters.minBudget) query = query.gte("budget_max", filters.minBudget);
  if (filters.notSyncedQuo) query = query.is("quo_synced_at", null);
  if (filters.leadDateWithinDays) {
    query = query.gte("lead_date", new Date(Date.now() - filters.leadDateWithinDays * 24 * 60 * 60 * 1000).toISOString());
  }
  if (filters.leadDateFrom) query = query.gte("lead_date", filters.leadDateFrom);
  if (filters.leadDateTo) query = query.lte("lead_date", filters.leadDateTo);
  if (filters.q) {
    const q = filters.q.trim();
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  // Tag, name, follow-up, and likelihood sorts need the joined data (or a
  // computed value) in hand first, so those are sorted in JS after the
  // fetch instead of in the query.
  const sort = filters.sort ?? "updated_desc";
  const jsSort = new Set<ContactSort>(["name_asc", "name_desc", "follow_up_asc", "tag_asc", "likelihood_desc"]);
  if (sort === "created_desc") query = query.order("created_at", { ascending: false });
  else if (sort === "created_asc") query = query.order("created_at", { ascending: true });
  else if (sort === "lead_date_desc") query = query.order("lead_date", { ascending: false });
  else if (sort === "lead_date_asc") query = query.order("lead_date", { ascending: true });
  else if (!jsSort.has(sort)) query = query.order("updated_at", { ascending: false });

  const { data } = await query;
  let contacts = (data ?? []) as ContactWithRelations[];

  if (filters.hasPhone) contacts = contacts.filter((c) => hasUsablePhone(c.phone));
  if (filters.missingPhone) contacts = contacts.filter((c) => !hasUsablePhone(c.phone));
  if (filters.leadSource) contacts = contacts.filter((c) => leadSourceMatches(c.lead_source, filters.leadSource!));
  if (filters.gender) contacts = contacts.filter((c) => contactMatchesGender(c.first_name, filters.gender));

  if (filters.tagIds?.length) {
    const tagIds = filters.tagIds;
    contacts = contacts.filter((c) => c.contact_tags.some((ct) => ct.tags && tagIds.includes(ct.tags.id)));
  }

  if (filters.inListIds?.length) {
    const { data: lists } = await supabase.from("contact_segments").select("filters").in("id", filters.inListIds);
    const allowed = new Set<string>();
    for (const row of lists ?? []) {
      for (const id of membershipIdsFromFilters(row.filters)) allowed.add(id);
    }
    contacts = contacts.filter((c) => allowed.has(c.id));
  }

  if (filters.lastTouchOlderThanDays) {
    const lastTouchById = await getLastTouchAts(contacts.map((c) => c.id));
    const days = filters.lastTouchOlderThanDays;
    contacts = contacts.filter((c) => lastTouchIsOlderThan(lastTouchById.get(c.id), days));
  }

  if (filters.registeredEventName) {
    // Any-event (__any__) matches every Eventbrite/CRM signup, including
    // rows whose event_name is null. A named event still matches on title.
    // Call-only Other / inbound Quo stubs have no eventbrite activity.
    const { data: registrations } = await supabase
      .from("activities")
      .select("contact_id, source, metadata")
      .eq("source", EVENT_REGISTRATION_SOURCE);
    const refs = (registrations ?? []).map((r) => ({
      contactId: r.contact_id as string,
      eventName: eventNameFromMetadata(r.metadata),
      source: (r.source as string) ?? EVENT_REGISTRATION_SOURCE,
    }));
    const registeredIds = registeredContactIds(filters.registeredEventName, refs);
    contacts = contacts.filter((c) => registeredIds.has(c.id));
  }

  if (filters.eventName) {
    const { data: attendance } = await supabase
      .from("activities")
      .select("contact_id, source, metadata")
      .in("source", [...EVENT_ATTENDANCE_SOURCES]);
    const refs = (attendance ?? []).map((r) => ({
      contactId: r.contact_id as string,
      eventName: eventNameFromMetadata(r.metadata),
      source: r.source as string,
    }));
    const attendedIds = attendedContactIds(filters.eventName, contacts, refs);
    contacts = contacts.filter((c) => attendedIds.has(c.id));
  }

  if (filters.hasNotes) contacts = contacts.filter((c) => !!c.notes?.trim());
  if (filters.missingNotes) contacts = contacts.filter((c) => !c.notes?.trim());
  if (filters.birthdayMonth) {
    contacts = contacts.filter((c) => !!c.birthday && new Date(c.birthday).getUTCMonth() + 1 === filters.birthdayMonth);
  }

  // Likelihood and the "queue" working lists both need the full stage set
  // to compute against, so only fetch it when one of those is actually in
  // play - the common case (no likelihood/queue filter) skips this entirely.
  if (filters.likelihood || filters.queue) {
    const stages = await listStages();
    if (filters.likelihood) {
      contacts = contacts.filter((c) => computeLikelihood(c, stages) === filters.likelihood);
    }
    if (filters.queue) {
      contacts = await filterByQueue(contacts, filters.queue, stages);
    }
  }

  if (filters.includeIds?.length) {
    contacts = await applyIncludeIds(supabase, contacts, filters);
  }

  if (sort === "name_asc") {
    contacts = [...contacts].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
  } else if (sort === "name_desc") {
    contacts = [...contacts].sort((a, b) => `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`));
  } else if (sort === "follow_up_asc") {
    contacts = [...contacts].sort((a, b) => {
      if (!a.next_follow_up_at && !b.next_follow_up_at) return 0;
      if (!a.next_follow_up_at) return 1;
      if (!b.next_follow_up_at) return -1;
      return new Date(a.next_follow_up_at).getTime() - new Date(b.next_follow_up_at).getTime();
    });
  } else if (sort === "tag_asc") {
    const firstTagName = (c: ContactWithRelations) =>
      [...c.contact_tags]
        .filter((ct) => ct.tags)
        .sort((x, y) => x.tags!.name.localeCompare(y.tags!.name))[0]?.tags!.name;
    contacts = [...contacts].sort((a, b) => {
      const tagA = firstTagName(a);
      const tagB = firstTagName(b);
      if (!tagA && !tagB) return 0;
      if (!tagA) return 1;
      if (!tagB) return -1;
      return tagA.localeCompare(tagB);
    });
  } else if (sort === "likelihood_desc") {
    const stages = await listStages();
    const rank = { high: 2, medium: 1, low: 0 } as const;
    contacts = [...contacts].sort((a, b) => {
      const la = computeLikelihood(a, stages);
      const lb = computeLikelihood(b, stages);
      return (lb ? rank[lb] : -1) - (la ? rank[la] : -1);
    });
  }

  return contacts;
}

function hasRestrictiveFilters(filters: ContactListFilters): boolean {
  return Boolean(
    filters.stageId ||
      filters.stageIds?.length ||
      filters.gender ||
      filters.tagIds?.length ||
      filters.type ||
      filters.timeline ||
      filters.representing ||
      filters.leadSource ||
      filters.hasPhone ||
      filters.missingPhone ||
      filters.hasEmail ||
      filters.missingEmail ||
      filters.hasFollowUp ||
      filters.missingFollowUp ||
      filters.overdueFollowUp ||
      filters.hasNotes ||
      filters.missingNotes ||
      filters.birthdayMonth ||
      filters.city ||
      filters.state ||
      filters.minBudget ||
      filters.notSyncedQuo ||
      filters.eventName ||
      filters.registeredEventName ||
      filters.likelihood ||
      filters.queue ||
      filters.leadDateWithinDays ||
      filters.leadDateFrom ||
      filters.leadDateTo ||
      filters.lastTouchOlderThanDays ||
      filters.inListIds?.length,
  );
}

async function applyIncludeIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contacts: ContactWithRelations[],
  filters: ContactListFilters,
): Promise<ContactWithRelations[]> {
  const includeIds = filters.includeIds ?? [];
  if (includeIds.length === 0) return contacts;

  if (!hasRestrictiveFilters(filters)) {
    const restricted = contacts.filter((c) => includeIds.includes(c.id));
    const have = new Set(restricted.map((c) => c.id));
    const missing = includeIds.filter((id) => !have.has(id));
    if (missing.length === 0) return restricted;
    const { data } = await supabase.from("contacts").select("*, pipeline_stages(*), contact_tags(tags(*))").eq("spam", false).in("id", missing);
    return [...restricted, ...((data ?? []) as ContactWithRelations[])];
  }

  const have = new Set(contacts.map((c) => c.id));
  const missing = includeIds.filter((id) => !have.has(id));
  if (missing.length === 0) return contacts;
  const { data } = await supabase.from("contacts").select("*, pipeline_stages(*), contact_tags(tags(*))").eq("spam", false).in("id", missing);
  return [...contacts, ...((data ?? []) as ContactWithRelations[])];
}

// Populates the "Last event attended" filter dropdown with whatever event
// names actually exist on real contacts (from Jotform/QR check-ins), plus
// historical attendance activity titles so an older meetup still appears
// after someone checks in at a later one.
export async function listLastEventNames() {
  const supabase = await createClient();
  const [{ data: contacts }, { data: attendance }] = await Promise.all([
    supabase.from("contacts").select("last_event_name").eq("archived", false).not("last_event_name", "is", null),
    supabase.from("activities").select("metadata").in("source", [...EVENT_ATTENDANCE_SOURCES]),
  ]);
  const values = new Set<string>();
  for (const c of contacts ?? []) {
    const name = c.last_event_name as string | null;
    if (name?.trim()) values.add(name);
  }
  for (const row of attendance ?? []) {
    const name = eventNameFromMetadata(row.metadata);
    if (name) values.add(name);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

// Populates the "Registered for event" filter/quick-select with every
// distinct event name from real Eventbrite registrations, most recently
// registered-for first - there's no stored event date to sort by, but the
// event with the most recent signups is the best available proxy for
// "the next/current meetup" so it lands at the top of the dropdown.
export async function listRegisteredEventNames() {
  const supabase = await createClient();
  const { data } = await supabase.from("activities").select("occurred_at, metadata").eq("source", "eventbrite");

  const latestByEvent = new Map<string, string>();
  for (const row of data ?? []) {
    const eventName = (row.metadata as Record<string, unknown> | null)?.event_name;
    if (typeof eventName !== "string" || !eventName.trim()) continue;
    const occurredAt = row.occurred_at as string;
    const existing = latestByEvent.get(eventName);
    if (!existing || occurredAt > existing) latestByEvent.set(eventName, occurredAt);
  }

  return [...latestByEvent.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([name]) => name);
}

// lead_source is free text (not FK'd to a lookup table - see ContactForm's
// LEAD_SOURCES suggestion list), so "distinct values" has to be computed
// here rather than via a join. Used to populate the source filter dropdown
// with whatever values actually exist on real contacts, including ones
// typed in by hand or brought in via CSV import that aren't in the
// suggestion list.
export async function listLeadSources() {
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("lead_source").eq("archived", false).not("lead_source", "is", null);
  const values = new Set((data ?? []).map((c) => c.lead_source as string).filter((s) => s.trim().length > 0));
  return [...values].sort((a, b) => a.localeCompare(b));
}

export async function listSegments() {
  const supabase = await createClient();
  const { data } = await supabase.from("contact_segments").select("*").order("sort_order", { ascending: true });
  return (data ?? []) as ContactSegment[];
}

export async function getContact(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*, pipeline_stages(*), contact_tags(tags(*))")
    .eq("id", id)
    .single();
  return data as ContactWithRelations | null;
}

export async function getContactActivities(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: false });
  return (data ?? []) as Activity[];
}

export async function getContactInsights(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("contact_id", contactId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false });
  return (data ?? []) as AiInsight[];
}

export async function getContactDeals(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("contact_id", contactId)
    .order("closed_at", { ascending: false });
  return (data ?? []) as Deal[];
}

export async function getContactTasks(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("contact_id", contactId)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false });
  return (data ?? []) as Task[];
}
