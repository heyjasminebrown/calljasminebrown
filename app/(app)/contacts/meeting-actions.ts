"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMeetingInvite } from "@/lib/google/calendar";
import { upsertActivity } from "@/lib/crm/activities";

export async function scheduleMeeting(
  contactId: string,
  input: { title: string; startAt: string; durationMinutes: number; notes?: string },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!input.title.trim()) return { ok: false as const, error: "Give the meeting a title" };
  if (!input.startAt) return { ok: false as const, error: "Pick a date and time" };

  const { data: contact } = await supabase.from("contacts").select("id, first_name, last_name, email, phone").eq("id", contactId).maybeSingle();
  if (!contact) return { ok: false as const, error: "Contact not found" };
  if (!contact.email) return { ok: false as const, error: "This contact doesn't have an email on file - add one first" };

  const admin = createAdminClient();
  const attendeeName = `${contact.first_name} ${contact.last_name}`.trim();
  const title = input.title.trim();

  const result = await createMeetingInvite(admin, user.id, {
    attendeeEmail: contact.email,
    attendeeName,
    title,
    description: input.notes?.trim() || undefined,
    startAt: input.startAt,
    durationMinutes: input.durationMinutes,
    // Meetings are phone calls (no video link).
    location: contact.phone ? `Phone call: ${contact.phone}` : "Phone call",
  });
  if (!result.ok) return result;

  await upsertActivity(admin, user.id, contactId, "manual", "google_event_id", result.eventId || null, {
    type: "meeting",
    direction: "none",
    occurred_at: input.startAt,
    body: `Scheduled: ${title}`,
    metadata: {
      google_event_id: result.eventId,
      html_link: result.htmlLink,
      duration_minutes: input.durationMinutes,
      notes: input.notes?.trim() || null,
    },
  });

  return { ok: true as const };
}
