import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertActivity } from "@/lib/crm/activities";

// Same insert-first, catch-23505 pattern as createOrGetTranscript/
// upsertActivity - a real unique index (owner_id, ig_message_id) does the
// dedupe work, not a select-then-branch race.
export async function createOrGetInstagramMessage(
  admin: SupabaseClient,
  input: { ownerId: string; contactId: string | null; igSenderId: string; igMessageId: string; text: string; occurredAt: string; raw: Record<string, unknown> },
): Promise<{ id: string; wasCreated: boolean }> {
  const basePayload = {
    owner_id: input.ownerId,
    contact_id: input.contactId,
    ig_sender_id: input.igSenderId,
    ig_message_id: input.igMessageId,
    text: input.text,
    occurred_at: input.occurredAt,
    raw: input.raw,
  };

  const { data: created, error } = await admin.from("instagram_messages").insert(basePayload).select("id").maybeSingle();
  if (!error) return { id: created!.id as string, wasCreated: true };
  if (error.code !== "23505") throw error;

  const { data: existing } = await admin
    .from("instagram_messages")
    .select("id")
    .eq("owner_id", input.ownerId)
    .eq("ig_message_id", input.igMessageId)
    .maybeSingle();

  return { id: existing!.id as string, wasCreated: false };
}

export async function getRememberedMatch(admin: SupabaseClient, ownerId: string, igSenderId: string): Promise<string | null> {
  const { data } = await admin.from("instagram_contact_links").select("contact_id").eq("owner_id", ownerId).eq("ig_sender_id", igSenderId).maybeSingle();
  return data?.contact_id ?? null;
}

// Writes the activity, links this one row (and marks it matched), so a
// future getUnmatchedInstagramThreads() query no longer surfaces it as a
// stranger - the activities row is what the existing Messages inbox/
// contact thread already know how to render, no changes needed there.
export async function mirrorInstagramMessageToActivity(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  messageRowId: string,
  igMessageId: string,
  text: string,
  occurredAt: string,
): Promise<void> {
  await upsertActivity(admin, ownerId, contactId, "instagram", "ig_message_id", igMessageId, {
    type: "text",
    direction: "inbound",
    occurred_at: occurredAt,
    body: text,
    metadata: { ig_message_id: igMessageId, channel: "instagram" },
  });
  await admin.from("instagram_messages").update({ contact_id: contactId }).eq("id", messageRowId);
}

export async function rememberInstagramMatch(admin: SupabaseClient, ownerId: string, igSenderId: string, contactId: string): Promise<void> {
  await admin.from("instagram_contact_links").upsert({ owner_id: ownerId, ig_sender_id: igSenderId, contact_id: contactId }, { onConflict: "owner_id,ig_sender_id" });
}
