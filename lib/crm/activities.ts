import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivitySource, ActivityType, ActivityDirection } from "@/types/database";

// Shared across integrations: create or update an activity keyed by an
// external event id, so re-delivered webhooks update the same row instead
// of duplicating it.
//
// This used to be a plain select-then-insert against the id stored inside
// metadata - which is not safe under concurrency. Two near-simultaneous
// webhook deliveries for the same registration (Eventbrite is known to
// sometimes genuinely double-fire close together, not just redeliver
// after a timeout) could both run their "does this exist yet" select
// before either INSERT committed, both see nothing, and both proceed to
// insert a separate row - and since both looked brand new, both fired a
// push notification for the same signup. Real duplicate contacts/deals
// can follow from the same race in other callers.
//
// Fixed by inserting first against a real unique index (owner_id, source,
// dedupe_field, dedupe_value - see migration 0040) and letting Postgres
// itself enforce the race atomically: whichever request's insert commits
// first wins outright; the other's insert fails with a genuine
// unique-violation (never a false negative/positive the way a
// check-then-act select can), and only then falls back to updating the
// row that won.
export async function upsertActivity(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  source: ActivitySource,
  idField: string,
  idValue: string | null,
  fields: {
    type: ActivityType;
    direction: ActivityDirection;
    occurred_at: string;
    body: string | null;
    metadata: Record<string, unknown>;
  },
) {
  const basePayload = {
    owner_id: ownerId,
    contact_id: contactId,
    type: fields.type,
    direction: fields.direction,
    body: fields.body,
    occurred_at: fields.occurred_at,
    source,
    metadata: fields.metadata,
  };

  if (idValue) {
    const { data: created, error } = await admin
      .from("activities")
      .insert({ ...basePayload, dedupe_field: idField, dedupe_value: idValue })
      .select("id")
      .maybeSingle();

    if (!error) return { id: created?.id as string | undefined, wasCreated: true };
    if (error.code !== "23505") throw error;

    // Someone else's insert won the race - update that row instead.
    const { data: existing } = await admin
      .from("activities")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("source", source)
      .eq("dedupe_field", idField)
      .eq("dedupe_value", idValue)
      .maybeSingle();

    if (existing) {
      await admin.from("activities").update({ body: fields.body, metadata: fields.metadata }).eq("id", existing.id);
      // wasCreated: false lets a redelivered webhook (Eventbrite/Quo/etc.
      // resending the same event id) tell "this exact registration/call/
      // text already exists" apart from a genuinely new one - callers use
      // it to gate one-time side effects like a push notification, so a
      // retried delivery doesn't re-notify every time it's redelivered.
      return { id: existing.id as string, wasCreated: false };
    }
    // Vanishingly unlikely (the conflicting row was deleted between the
    // failed insert and this select) - fall through to a plain insert
    // rather than returning nothing.
  }

  const { data: created } = await admin
    .from("activities")
    .insert({ ...basePayload, dedupe_field: idValue ? idField : null, dedupe_value: idValue })
    .select("id")
    .maybeSingle();

  return { id: created?.id as string | undefined, wasCreated: true };
}

export async function patchActivityMetadata(
  admin: SupabaseClient,
  ownerId: string,
  source: ActivitySource,
  idField: string,
  idValue: string | null,
  patch: Record<string, unknown>,
) {
  if (!idValue) return null;
  const { data: existing } = await admin
    .from("activities")
    .select("id, contact_id, metadata, body, direction")
    .eq("owner_id", ownerId)
    .eq("source", source)
    .eq("dedupe_field", idField)
    .eq("dedupe_value", idValue)
    .maybeSingle();

  if (!existing) return null;

  const nextMetadata = { ...(existing.metadata as Record<string, unknown>), ...patch };
  const summary = typeof patch.summary === "string" ? patch.summary : undefined;

  await admin
    .from("activities")
    .update({
      metadata: nextMetadata,
      body: summary ? `${existing.body ?? ""}${existing.body ? " · " : ""}${summary}` : existing.body,
    })
    .eq("id", existing.id);

  // Follow-up events (a transcript/summary/recording completing) don't
  // carry the original call's direction themselves - handing back the
  // original activity's so callers don't have to guess it from a payload
  // shape that doesn't actually include it.
  return { contactId: existing.contact_id as string, direction: existing.direction as ActivityDirection };
}
