"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rememberInstagramMatch, mirrorInstagramMessageToActivity } from "@/lib/data/instagram-messages";
import { sendInstagramMessage } from "@/lib/instagram/graph-client";
import { updateEngagementTag } from "@/lib/crm/engagement";

// Shared by "That's her" (existing contact) and "New contact from this
// DM" - once instagram_contact_links exists for this sender, every past
// unmatched message from them mirrors onto the contact's timeline (not
// just future ones), and every future webhook delivery auto-resolves
// through the remembered link with no further action from her.
async function linkAndMirrorAll(ownerId: string, igSenderId: string, contactId: string) {
  const admin = createAdminClient();
  await rememberInstagramMatch(admin, ownerId, igSenderId, contactId);

  const { data: messages } = await admin
    .from("instagram_messages")
    .select("id, ig_message_id, text, occurred_at")
    .eq("owner_id", ownerId)
    .eq("ig_sender_id", igSenderId)
    .is("contact_id", null);

  for (const m of messages ?? []) {
    await mirrorInstagramMessageToActivity(admin, ownerId, contactId, m.id, m.ig_message_id, m.text, m.occurred_at);
  }
  await updateEngagementTag(admin, ownerId, contactId);
}

export async function matchInstagramSender(igSenderId: string, contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  await linkAndMirrorAll(user.id, igSenderId, contactId);
  return { ok: true as const };
}

export async function addInstagramContact(igSenderId: string, firstName: string, lastName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  const { data: firstStage } = await admin.from("pipeline_stages").select("id").eq("owner_id", user.id).order("sort_order", { ascending: true }).limit(1).maybeSingle();

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      owner_id: user.id,
      first_name: firstName.trim() || "Unknown",
      last_name: lastName.trim(),
      contact_type: "other",
      lead_source: "Instagram",
      stage_id: firstStage?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false as const, error: "Couldn't create the contact" };

  await linkAndMirrorAll(user.id, igSenderId, created.id);
  return { ok: true as const, contactId: created.id as string };
}

// Usable before a sender is matched to any contact (Meta's Send API only
// needs the sender's page-scoped id, not a CRM record) - "send them the
// registration link" from the stranger row works even if she never adds
// them as a contact at all.
export async function sendInstagramDirectMessage(igSenderId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) return { ok: false as const, error: "Instagram isn't connected yet - see Settings" };

  return sendInstagramMessage(igSenderId, text, pageAccessToken);
}
