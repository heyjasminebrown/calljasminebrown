"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMeetingInvite } from "@/lib/google/calendar";
import { upsertActivity } from "@/lib/crm/activities";
import { sendTextToContact } from "@/app/(app)/contacts/actions";
import { buildBookingConfirmedMessage, buildBookingDeclinedMessage, buildProposeNewTimeMessage } from "@/lib/crm/booking-message";
import { BOOKING_CONTACT_TYPE_OPTIONS } from "@/lib/crm/booking-form-options";
import { TIMELINE_LABELS } from "@/lib/utils";
import { baseUrl } from "@/lib/crm/sequences";
import type { WeeklyHours } from "@/types/database";

export async function updateSchedulingSettings(input: {
  durationMinutes: number;
  daysOut: number;
  visibleSlotPct: number;
  bufferMinutes: number;
  weeklyHours: WeeklyHours;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase
    .from("scheduling_settings")
    .upsert({
      owner_id: user.id,
      duration_minutes: input.durationMinutes,
      days_out: input.daysOut,
      visible_slot_pct: input.visibleSlotPct,
      buffer_minutes: input.bufferMinutes,
      weekly_hours: input.weeklyHours,
      updated_at: new Date().toISOString(),
    });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/scheduling");
  return { ok: true as const };
}

function generateSlug(): string {
  return randomBytes(6).toString("base64url");
}

// Reuses an existing link for this contact if one was already generated
// (e.g. she hit "Send scheduling link" twice) rather than minting a fresh
// slug every time - a contact only ever needs one standing link.
export async function createContactBookingLink(contactId: string): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: existing } = await supabase
    .from("booking_links")
    .select("slug")
    .eq("owner_id", user.id)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, link: `${baseUrl()}/book/${existing.slug}` };

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from("booking_links")
      .insert({ owner_id: user.id, contact_id: contactId, slug })
      .select("slug")
      .maybeSingle();
    if (!error && data) return { ok: true, link: `${baseUrl()}/book/${data.slug}` };
    if (error && error.code !== "23505") return { ok: false, error: "Couldn't create that link" };
  }
  return { ok: false, error: "Couldn't generate a unique link - try again" };
}

// Her explicit requirement: nothing is final until she approves it. Only
// on approval does a real Google Calendar event get created and a
// confirmation text go out - a pending request is otherwise invisible to
// the visitor beyond "request sent."
export async function approveBooking(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: request } = await supabase.from("booking_requests").select("*").eq("id", requestId).eq("owner_id", user.id).maybeSingle();
  if (!request) return { ok: false as const, error: "Request not found" };
  if (request.stage !== "pending") return { ok: false as const, error: "Already decided" };
  if (!request.starts_at || !request.ends_at) return { ok: false as const, error: "No time attached to this request" };

  const admin = createAdminClient();
  const durationMinutes = Math.round((new Date(request.ends_at).getTime() - new Date(request.starts_at).getTime()) / 60_000);
  const contactTypeLabel = BOOKING_CONTACT_TYPE_OPTIONS.find((o) => o.value === request.contact_type)?.label;
  const description = [
    contactTypeLabel ? `${contactTypeLabel}` : null,
    request.timeline ? `Timeline: ${TIMELINE_LABELS[request.timeline]}` : null,
    request.questions ? `Questions: ${request.questions}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const invite = await createMeetingInvite(admin, user.id, {
    attendeeEmail: request.visitor_email,
    attendeeName: request.visitor_name,
    title: `Meeting with ${request.visitor_name}`,
    description: description || undefined,
    startAt: request.starts_at,
    durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
  });
  if (!invite.ok) return { ok: false as const, error: invite.error };

  const { error } = await supabase
    .from("booking_requests")
    .update({ stage: "approved", google_event_id: invite.eventId, decided_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { ok: false as const, error: error.message };

  if (request.contact_id) {
    const message = buildBookingConfirmedMessage({
      visitorFirstName: request.visitor_name.split(" ")[0] || request.visitor_name,
      startsAt: request.starts_at,
      meetLink: invite.meetLink,
    });
    await sendTextToContact(request.contact_id, request.visitor_phone, message);

    await upsertActivity(admin, user.id, request.contact_id, "scheduling", "booking_request_id", request.id, {
      type: "meeting",
      direction: "none",
      occurred_at: request.starts_at,
      body: `Booked via scheduling link`,
      metadata: { google_event_id: invite.eventId, meet_link: invite.meetLink, booking_request_id: request.id },
    });
  }

  revalidatePath("/scheduling");
  revalidatePath("/");
  return { ok: true as const };
}

export async function declineBooking(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: request } = await supabase
    .from("booking_requests")
    .select("*, booking_links(slug)")
    .eq("id", requestId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!request) return { ok: false as const, error: "Request not found" };
  if (request.stage !== "pending") return { ok: false as const, error: "Already decided" };
  if (!request.starts_at) return { ok: false as const, error: "No time attached to this request" };

  const { error } = await supabase.from("booking_requests").update({ stage: "declined", decided_at: new Date().toISOString() }).eq("id", requestId);
  if (error) return { ok: false as const, error: error.message };

  const bookingLink = (request as unknown as { booking_links: { slug: string } | null }).booking_links;
  if (request.contact_id) {
    const message = buildBookingDeclinedMessage({
      visitorFirstName: request.visitor_name.split(" ")[0] || request.visitor_name,
      startsAt: request.starts_at,
      // A contact-specific link rebooks through their own prefilled
      // page; a request that came in through the bare /book address
      // (no link at all) rebooks through that same easy address.
      rebookLink: bookingLink ? `${baseUrl()}/book/${bookingLink.slug}` : `${baseUrl()}/book`,
    });
    await sendTextToContact(request.contact_id, request.visitor_phone, message);
  }

  revalidatePath("/scheduling");
  revalidatePath("/");
  return { ok: true as const };
}

// Her "I need to decline but offer something else" path - instead of a
// flat decline, she picks a different time and the visitor confirms it
// themselves through a link (app/confirm/[token]) - that confirmation is
// what actually books it, not this action. Nothing's final yet, so the
// request moves to 'time_proposed' rather than 'declined'.
export async function proposeNewTime(requestId: string, proposedStartsAt: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: request } = await supabase.from("booking_requests").select("*").eq("id", requestId).eq("owner_id", user.id).maybeSingle();
  if (!request) return { ok: false as const, error: "Request not found" };
  if (request.stage !== "pending") return { ok: false as const, error: "Already decided" };
  if (!request.starts_at || !request.ends_at) return { ok: false as const, error: "No time attached to this request" };

  const durationMs = new Date(request.ends_at).getTime() - new Date(request.starts_at).getTime();
  const proposedEndsAt = new Date(new Date(proposedStartsAt).getTime() + (durationMs > 0 ? durationMs : 30 * 60_000)).toISOString();

  let token = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateSlug();
    const { error } = await supabase
      .from("booking_requests")
      .update({ proposed_starts_at: proposedStartsAt, proposed_ends_at: proposedEndsAt, propose_token: candidate, stage: "time_proposed" })
      .eq("id", requestId);
    if (!error) {
      token = candidate;
      break;
    }
    if (error.code !== "23505") return { ok: false as const, error: "Couldn't save that - try again" };
  }
  if (!token) return { ok: false as const, error: "Couldn't generate a unique link - try again" };

  if (request.contact_id) {
    const message = buildProposeNewTimeMessage({
      visitorFirstName: request.visitor_name.split(" ")[0] || request.visitor_name,
      originalStartsAt: request.starts_at,
      proposedStartsAt,
      confirmLink: `${baseUrl()}/confirm/${token}`,
    });
    await sendTextToContact(request.contact_id, request.visitor_phone, message);
  }

  revalidatePath("/scheduling");
  revalidatePath("/");
  return { ok: true as const };
}

// Pulls a proposal back to 'pending' (not a delete - same "keep history,
// let her decide again" reasoning as everywhere else in this file) if she
// wants to reconsider before the visitor confirms it.
export async function cancelProposedTime(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase
    .from("booking_requests")
    .update({ stage: "pending", proposed_starts_at: null, proposed_ends_at: null, propose_token: null })
    .eq("id", requestId)
    .eq("owner_id", user.id)
    .eq("stage", "time_proposed");
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/scheduling");
  return { ok: true as const };
}

// She can cancel an abandoned session herself (e.g. she already reached
// out directly and it's not worth leaving in the list) - never deletes,
// same "keep history" reasoning as decline.
export async function cancelAbandonedSession(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase
    .from("booking_requests")
    .update({ stage: "canceled", decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("owner_id", user.id)
    .in("stage", ["info", "time_selected"]);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/scheduling");
  revalidatePath("/");
  return { ok: true as const };
}
