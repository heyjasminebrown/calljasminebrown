import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/types/database";
import { isTodayWorkContact } from "@/lib/crm/today-eligible";

export const NEW_LEAD_DISMISS_KEY = "new_lead_never_contacted";
const NEW_LEAD_WINDOW_DAYS = 14;

export type NewLeadContact = Pick<
  Contact,
  "id" | "first_name" | "last_name" | "phone" | "lead_source" | "lead_date" | "stage_id" | "last_event_name"
> & { tagNames: string[] };

// "New Leads": the source-agnostic queue that replaces the Dialer's old
// Eventbrite/Calendly/listing_page-only "New registrations" tab. Anyone
// with zero outbound touch ever (not "since some anchor" - a genuine
// first contact hasn't happened yet), regardless of where they came from.
//
// Scoped to lead_date (not created_at) - see migration 0028's comment:
// lead_date is the lead's real original date and defaults to created_at
// for ordinary inserts, but a bulk CSV import backdates it while
// created_at is just "when this row was inserted." Using created_at here
// would make an old, already-worked CSV import look brand-new the moment
// it's imported - getStatStrip's own "new leads this week" stat already
// uses lead_date for the same reason.
export async function listNewLeadsQueue(): Promise<{ contacts: NewLeadContact[]; error: string | null }> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - NEW_LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: candidatesError } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, phone, lead_source, lead_date, stage_id, last_event_name, contact_tags(tags(name))")
    .eq("archived", false)
    .eq("known_personally", false)
    .eq("spam", false)
    .is("opted_out_at", null)
    .not("phone", "is", null)
    .gte("lead_date", windowStart);

  // A query error here must never silently render as "nobody left" - that's
  // indistinguishable from a genuinely empty, healthy queue.
  if (candidatesError) return { contacts: [], error: candidatesError.message };
  if (!candidates || candidates.length === 0) return { contacts: [], error: null };

  const candidateIds = candidates.map((c) => c.id);

  const { data: outreach, error: outreachError } = await supabase
    .from("activities")
    .select("contact_id")
    .in("type", ["call", "text", "email"])
    .eq("direction", "outbound")
    .in("contact_id", candidateIds);
  if (outreachError) return { contacts: [], error: outreachError.message };
  const contactedIds = new Set((outreach ?? []).map((r) => r.contact_id as string));

  const { data: dismissals, error: dismissError } = await supabase
    .from("dismissed_insights")
    .select("contact_id")
    .eq("insight_key", NEW_LEAD_DISMISS_KEY)
    .in("contact_id", candidateIds);
  if (dismissError) return { contacts: [], error: dismissError.message };
  const dismissedIds = new Set((dismissals ?? []).map((r) => r.contact_id as string));

  const eligible = candidates
    .filter((c) => !contactedIds.has(c.id) && !dismissedIds.has(c.id) && isTodayWorkContact(c))
    .map((c) => {
      const tagRows = (c.contact_tags ?? []) as { tags?: { name?: string } | { name?: string }[] | null }[];
      const tagNames = tagRows.flatMap((row) => {
        const tags = row.tags;
        if (!tags) return [];
        return Array.isArray(tags) ? tags.map((t) => t.name) : [tags.name];
      }).filter((name): name is string => !!name);
      return {
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        phone: c.phone,
        lead_source: c.lead_source,
        lead_date: c.lead_date,
        stage_id: c.stage_id,
        last_event_name: c.last_event_name,
        tagNames,
      } satisfies NewLeadContact;
    });

  // Oldest first - whoever's been sitting untouched the longest inside the
  // 14-day window surfaces first, since the whole point is nobody should
  // age out unattended.
  eligible.sort((a, b) => new Date(a.lead_date).getTime() - new Date(b.lead_date).getTime());

  return { contacts: eligible, error: null };
}
