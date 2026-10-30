"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots, type Slot } from "@/lib/crm/booking-availability";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { upsertActivity } from "@/lib/crm/activities";
import { notifyNewLead } from "@/lib/push/send-push";
import { BOOKING_CONTACT_TYPE_OPTIONS } from "@/lib/crm/booking-form-options";
import { TIMELINE_LABELS } from "@/lib/utils";
import type { SchedulingSettings, WeeklyHours, BookingContactType, Timeline } from "@/types/database";

// Public, unauthenticated by design - shared by both /book (generic, no
// slug) and /book/[slug] (contact-prefilled) - every action here goes
// through the admin client scoped to the single owner account, not a
// user session. Same pattern as app/n/[slug]/actions.ts.
const OWNER_ID = process.env.CRM_OWNER_USER_ID;
const SLUG_FORMAT = /^[A-Za-z0-9_-]{8}$/;

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: { enabled: true, start: "10:00", end: "18:00" },
  tue: { enabled: true, start: "10:00", end: "18:00" },
  wed: { enabled: true, start: "10:00", end: "18:00" },
  thu: { enabled: true, start: "10:00", end: "18:00" },
  fri: { enabled: true, start: "10:00", end: "18:00" },
  sat: { enabled: false, start: "10:00", end: "18:00" },
  sun: { enabled: false, start: "10:00", end: "18:00" },
};

// A booking link (or the bare /book address) can be used before she's
// ever opened Settings > Scheduling (the row that lazily creates
// scheduling_settings) - falls back to the same defaults that row would
// get, so the public page always works.
// Public intro calls are 20 minutes. CRM scheduling settings can still
// store another length for meetings she books herself.
const PUBLIC_INTRO_MINUTES = 20;

function withDefaults(row: SchedulingSettings | null) {
  return {
    durationMinutes: row?.duration_minutes ?? 30,
    daysOut: row?.days_out ?? 14,
    visibleSlotPct: row?.visible_slot_pct ?? 50,
    bufferMinutes: row?.buffer_minutes ?? 15,
    weeklyHours: row?.weekly_hours ?? DEFAULT_WEEKLY_HOURS,
  };
}

const ACTIVE_STAGES = new Set(["info", "time_selected", "pending"]);

export type BookingFlowData = {
  durationMinutes: number;
  prefill: { name: string; phone: string; email: string } | null;
  slots: Slot[];
};

export async function getBookingFlowData(slug: string | null): Promise<BookingFlowData | null> {
  if (!OWNER_ID) return null;
  if (slug && !SLUG_FORMAT.test(slug)) return null;

  const admin = createAdminClient();

  let prefill: BookingFlowData["prefill"] = null;
  if (slug) {
    const { data: link } = await admin.from("booking_links").select("contact_id").eq("owner_id", OWNER_ID).eq("slug", slug).maybeSingle();
    if (!link) return null;
    const { data: contact } = await admin.from("contacts").select("first_name, last_name, phone, email").eq("id", link.contact_id).maybeSingle();
    if (contact) {
      prefill = { name: `${contact.first_name} ${contact.last_name}`.trim(), phone: contact.phone ?? "", email: contact.email ?? "" };
    }
  }

  const { data: settingsRow } = await admin.from("scheduling_settings").select("*").eq("owner_id", OWNER_ID).maybeSingle();
  const settings = { ...withDefaults(settingsRow as SchedulingSettings | null), durationMinutes: PUBLIC_INTRO_MINUTES };

  const slots = await computeAvailableSlots(admin, OWNER_ID, settings);
  return { durationMinutes: PUBLIC_INTRO_MINUTES, prefill, slots };
}

// Step 1: name/phone/email. Creates the booking_requests row right away
// (stage 'info') and resolves/creates the contact immediately - this is
// what makes an abandoned attempt visible to her on /scheduling even if
// they never pick a time at all.
export async function startBookingSession(input: {
  slug: string | null;
  name: string;
  phone: string;
  email: string;
}): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "This link isn't set up yet." };
  if (input.slug && !SLUG_FORMAT.test(input.slug)) return { ok: false, error: "This link isn't valid." };
  if (!input.name.trim() || !input.phone.trim()) return { ok: false, error: "Name and phone are required." };

  const admin = createAdminClient();

  let linkId: string | null = null;
  if (input.slug) {
    const { data: link } = await admin.from("booking_links").select("id").eq("owner_id", OWNER_ID).eq("slug", input.slug).maybeSingle();
    if (!link) return { ok: false, error: "This link isn't valid." };
    linkId = link.id;
  }

  const nameParts = input.name.trim().split(/\s+/);
  const contact = await findOrCreateContact(admin, OWNER_ID, {
    email: input.email.trim() || null,
    phone: input.phone.trim(),
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(" ") || null,
    leadSource: "Scheduling page",
  });

  const { data: created, error } = await admin
    .from("booking_requests")
    .insert({
      owner_id: OWNER_ID,
      booking_link_id: linkId,
      contact_id: contact?.id ?? null,
      visitor_name: input.name.trim(),
      visitor_phone: input.phone.trim(),
      visitor_email: input.email.trim() || null,
      stage: "info",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Couldn't start that - try again." };

  return { ok: true, sessionId: created.id as string };
}

// Step 2: pick a time. Re-validates against a fresh availability
// computation rather than trusting the slot the browser last saw -
// guards both a real race (someone else grabbed it a second ago) and a
// guessed/replayed time that was never actually shown (including one
// hidden by the "looks busier" filter).
export async function selectBookingSlot(sessionId: string, startsAt: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "server not configured" };
  const admin = createAdminClient();

  const { data: session } = await admin.from("booking_requests").select("id, stage").eq("id", sessionId).eq("owner_id", OWNER_ID).maybeSingle();
  if (!session || !ACTIVE_STAGES.has(session.stage)) return { ok: false, error: "This booking session isn't active anymore." };

  const { data: settingsRow } = await admin.from("scheduling_settings").select("*").eq("owner_id", OWNER_ID).maybeSingle();
  const settings = { ...withDefaults(settingsRow as SchedulingSettings | null), durationMinutes: PUBLIC_INTRO_MINUTES };
  const slots = await computeAvailableSlots(admin, OWNER_ID, settings);
  const slot = slots.find((s) => s.startAt === startsAt);
  if (!slot) return { ok: false, error: "That time isn't available anymore - pick another." };

  const { error } = await admin
    .from("booking_requests")
    .update({ starts_at: slot.startAt, ends_at: slot.endAt, stage: "time_selected" })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "Couldn't save that - try again." };

  return { ok: true };
}

// Step 3: who they are, timeline, notes, questions. Moves the session to
// 'pending' - ready for her review - enriches the contact record right
// away (not gated on her approving), and notifies her with the full
// picture so she has everything she needs before deciding.
export async function submitBookingDetails(
  sessionId: string,
  input: { contactType: BookingContactType | null; timeline: Timeline | null; questions: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!OWNER_ID) return { ok: false, error: "server not configured" };
  const admin = createAdminClient();

  const { data: session } = await admin.from("booking_requests").select("*").eq("id", sessionId).eq("owner_id", OWNER_ID).maybeSingle();
  if (!session || !session.starts_at) return { ok: false, error: "Pick a time first." };
  if (!ACTIVE_STAGES.has(session.stage)) return { ok: false, error: "This booking session isn't active anymore." };

  const questions = input.questions.trim() || null;

  const { error } = await admin
    .from("booking_requests")
    .update({
      contact_type: input.contactType,
      timeline: input.timeline,
      questions,
      stage: "pending",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "Couldn't save that - try again." };

  if (session.contact_id) {
    await enrichContactFromBooking(admin, OWNER_ID, session.contact_id, sessionId, {
      contactType: input.contactType,
      timeline: input.timeline,
      questions,
    });
  }

  const contactTypeLabel = BOOKING_CONTACT_TYPE_OPTIONS.find((o) => o.value === input.contactType)?.label;
  const when = new Date(session.starts_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const bodyParts = [when, contactTypeLabel, input.timeline ? TIMELINE_LABELS[input.timeline] : null].filter(Boolean);

  await notifyNewLead(admin, OWNER_ID, {
    title: session.visitor_name,
    body: `Requested ${bodyParts.join(" · ")} - review it`,
    url: "/scheduling",
  });

  return { ok: true };
}

// Fills in what's still missing rather than overwriting anything real -
// same enrich-don't-clobber philosophy as findOrCreateContact's own
// enrichContact. Notes/questions always get logged as a fresh activity
// though, since those are new information from this specific booking,
// not a field correction.
async function enrichContactFromBooking(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  contactId: string,
  sessionId: string,
  input: { contactType: BookingContactType | null; timeline: Timeline | null; questions: string | null },
) {
  const { data: contact } = await admin.from("contacts").select("contact_type, timeline, representing").eq("id", contactId).maybeSingle();
  if (contact) {
    const patch: Record<string, unknown> = {};
    if (input.contactType && contact.contact_type === "other") patch.contact_type = input.contactType;
    if (input.timeline && contact.timeline === "unknown") patch.timeline = input.timeline;
    if (!contact.representing && (input.contactType === "buyer" || input.contactType === "seller" || input.contactType === "both")) {
      patch.representing = input.contactType;
    }
    if (Object.keys(patch).length > 0) {
      await admin.from("contacts").update(patch).eq("id", contactId);
    }
  }

  const noteParts = [input.questions ? `Questions: ${input.questions}` : null].filter(Boolean);
  if (noteParts.length === 0) return;

  // Distinct dedupe field from the "booked" confirmation activity
  // approveBooking logs (both key off the same sessionId, but they're
  // two different activities - a shared dedupe_field would collide and
  // silently overwrite one with the other).
  await upsertActivity(admin, ownerId, contactId, "scheduling", "booking_request_notes_id", sessionId, {
    type: "note",
    direction: "none",
    occurred_at: new Date().toISOString(),
    body: `Filled out before booking time - ${noteParts.join(" · ")}`,
    metadata: { booking_request_id: sessionId },
  });
}
