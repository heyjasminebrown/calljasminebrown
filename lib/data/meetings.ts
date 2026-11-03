import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUpcomingEvents } from "@/lib/google/calendar";

// Every meeting the CRM knows about, from any source: bookings from the
// public page, meetings scheduled from a contact, Calendly. They're all
// logged as "meeting" activities at the meeting's start time.
export type UpcomingMeeting = {
  id: string;
  contactId: string;
  contactName: string;
  startsAt: string;
  title: string;
  meetLink: string | null;
  durationMinutes: number | null;
};

export async function listUpcomingMeetings(opts: { days?: number; limit?: number } = {}): Promise<{ meetings: UpcomingMeeting[]; error: string | null }> {
  const supabase = await createClient();
  const now = Date.now();
  // Still show a meeting that started up to an hour ago (it may be going on).
  const from = new Date(now - 60 * 60 * 1000).toISOString();
  const to = new Date(now + (opts.days ?? 30) * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("activities")
    .select("id, contact_id, occurred_at, body, metadata, contacts!inner(first_name, last_name, archived)")
    .eq("type", "meeting")
    .eq("contacts.archived", false)
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: true })
    .limit(opts.limit ?? 50);
  if (error) return { meetings: [], error: error.message };

  let rows = data ?? [];

  // Drop meetings that were cancelled or deleted in Google Calendar. If
  // Google can't be reached, show them all rather than hiding real ones.
  const eventIds = rows.map((r) => (r.metadata as { google_event_id?: string } | null)?.google_event_id).filter((id): id is string => !!id);
  if (eventIds.length > 0) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const events = await listUpcomingEvents(createAdminClient(), user.id, from, to);
        if (events.length > 0) {
          const live = new Set(events.map((e) => e.id));
          rows = rows.filter((r) => {
            const id = (r.metadata as { google_event_id?: string } | null)?.google_event_id;
            return !id || live.has(id);
          });
        }
      }
    } catch {
      // keep every meeting
    }
  }

  return {
    meetings: rows.map((r) => {
      const contact = r.contacts as unknown as { first_name: string; last_name: string | null };
      const meta = (r.metadata ?? {}) as { meet_link?: string | null; duration_minutes?: number | null };
      return {
        id: r.id as string,
        contactId: r.contact_id as string,
        contactName: `${contact.first_name} ${contact.last_name ?? ""}`.trim(),
        startsAt: r.occurred_at as string,
        title: ((r.body as string | null) ?? "Meeting").replace(/^Scheduled: /, ""),
        meetLink: meta.meet_link ?? null,
        durationMinutes: typeof meta.duration_minutes === "number" ? meta.duration_minutes : null,
      };
    }),
    error: null,
  };
}
