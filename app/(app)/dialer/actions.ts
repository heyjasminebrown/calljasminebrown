"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchRecentTextsByContact, type TextThreadMessage } from "@/lib/crm/recent-texts";
import { fullName } from "@/lib/utils";
import type { ConfirmationSearchResult } from "@/lib/data/dialer";

type ActionResult = { ok: true } | { ok: false; error: string };

// Simple substring match in JS rather than a database ilike filter - the
// query comes straight from a text input, and building a safe PostgREST
// filter string out of arbitrary user input is more risk than it's worth
// at the (hundreds to low thousands of) contacts scale this app runs at.
export async function searchContactsToConfirm(query: string): Promise<ConfirmationSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("id, first_name, last_name, phone").eq("archived", false);

  return (data ?? [])
    .filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: fullName(c) || "Unnamed", phone: c.phone }));
}

// Backs the Dialer's conversation panel on all three queues - same shared
// fetch the bulk text blast's audience preview uses (see
// lib/crm/recent-texts.ts), just for one contact instead of a whole
// audience.
export async function getRecentTextsForContact(contactId: string): Promise<TextThreadMessage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const map = await fetchRecentTextsByContact(supabase, user.id, [contactId]);
  return map.get(contactId) ?? [];
}

// "No answer / voicemail / too short to count" - doesn't remove the
// contact from the dialer queue, just pushes them below anyone not yet
// tried. Silent by design (no modal) since nothing worth recording
// happened.
export async function markDialerSnoozed(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ dialer_snoozed_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// "Connected" - clears this contact off the New Registrations queue for
// their current registration. Reclassifying/adding notes is a separate
// follow-up step (see saveDialerNotes below) so closing that modal
// without filling it in doesn't leave them stuck back on the call list.
// If they register again later, this timestamp is older than the new
// registration, so they naturally reappear - "contacted" means "since
// their last registration," not "forever."
export async function markDialerConnected(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ dialer_contacted_at: new Date().toISOString(), dialer_snoozed_at: null })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Same idea as markDialerSnoozed/markDialerConnected above, but for the
// separate post-event follow-up queue - independent tracking columns so
// calling someone at registration doesn't also mark their (not-yet-
// happened) post-event follow-up as done, or vice versa.
export async function markEventFollowupSnoozed(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ event_followup_snoozed_at: new Date().toISOString() }).eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markEventFollowupConnected(contactId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ event_followup_contacted_at: new Date().toISOString(), event_followup_snoozed_at: null })
    .eq("id", contactId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// The confirmation queue is keyed by (event, contact) rather than just
// contact - see lib/data/dialer.ts's listConfirmationQueue - so these
// three upsert into event_confirmations instead of updating a column on
// contacts. eventName is only there to satisfy the not-null column on a
// first insert (a contact who's never been on this list for this event
// yet); source is deliberately omitted so an existing 'manual' row never
// gets silently reset to the 'registered' default on a later upsert.
export async function markConfirmationConnected(contactId: string, eventId: string, eventName: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("event_confirmations")
    .upsert(
      { owner_id: user.id, event_id: eventId, event_name: eventName, contact_id: contactId, confirmed_at: new Date().toISOString(), snoozed_at: null },
      { onConflict: "event_id,contact_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markConfirmationSnoozed(contactId: string, eventId: string, eventName: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("event_confirmations")
    .upsert({ owner_id: user.id, event_id: eventId, event_name: eventName, contact_id: contactId, snoozed_at: new Date().toISOString() }, { onConflict: "event_id,contact_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// "+ Add someone" on the confirmation list - a person she knows is
// interested but who never registered. ignoreDuplicates so re-adding
// someone already on the list (registered or previously added) is a
// harmless no-op rather than an error.
export async function addToConfirmationList(contactId: string, eventId: string, eventName: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("event_confirmations")
    .upsert(
      { owner_id: user.id, event_id: eventId, event_name: eventName, contact_id: contactId, source: "manual" },
      { onConflict: "event_id,contact_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
