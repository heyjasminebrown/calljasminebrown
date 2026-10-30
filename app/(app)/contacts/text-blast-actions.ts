"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuoText } from "@/lib/quo/send-message";
import { applyMergeFields, PREVIEW_CONTACT, hasPlaceholderName } from "@/lib/crm/merge-fields";
import { withProgress, tagBlastLabel, type TextBlastWithProgress } from "@/lib/crm/text-blasts";
import { fetchRecentTextsByContact, type TextThreadMessage } from "@/lib/crm/recent-texts";

type AudienceContact = { id: string; first_name: string; last_name: string; phone: string; email: string | null };
type AudienceResolution = { eligible: AudienceContact[]; optedOutCount: number };

// Split out from the id-in-list query every resolver below already runs -
// opted_out_at is fetched alongside instead of filtered in SQL, so "how
// many were excluded specifically for opting out" (the design brief's
// "84 registered, 81 can be texted, 3 opted out") is a plain count, not a
// second query. Consent recording (lib/crm/consent.ts) is enforcement
// input, not itself required here - a contact with no consent_at at all
// still receives an event-registration or tag blast the same as before;
// opted_out_at is the one flag that actually blocks a send.
function splitByOptOut(rows: (AudienceContact & { opted_out_at: string | null })[]): AudienceResolution {
  const eligible: AudienceContact[] = rows
    .filter((c) => !c.opted_out_at)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, phone: c.phone, email: c.email }));
  return { eligible, optedOutCount: rows.length - eligible.length };
}

// Not every bulk text is about a meetup registration - lets a blast reach
// everyone carrying a given tag instead (e.g. every "House Hacker", every
// "First-Time Buyer"), independent of event attendance entirely.
async function resolveTagAudience(admin: SupabaseClient, ownerId: string, tagId: string): Promise<AudienceResolution> {
  const { data: contactTags } = await admin.from("contact_tags").select("contact_id").eq("tag_id", tagId);
  const contactIds = [...new Set((contactTags ?? []).map((r) => r.contact_id as string))];
  if (contactIds.length === 0) return { eligible: [], optedOutCount: 0 };

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, email, opted_out_at")
    .in("id", contactIds)
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .not("phone", "is", null);

  return splitByOptOut((contacts ?? []) as (AudienceContact & { opted_out_at: string | null })[]);
}

// Not every bulk text has an event or a tag behind it either - a filtered
// slice of the Contacts list, hand-picked via its checkbox selection.
async function resolveContactsAudience(admin: SupabaseClient, ownerId: string, contactIds: string[]): Promise<AudienceResolution> {
  if (contactIds.length === 0) return { eligible: [], optedOutCount: 0 };

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, email, opted_out_at")
    .in("id", contactIds)
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .not("phone", "is", null);

  return splitByOptOut((contacts ?? []) as (AudienceContact & { opted_out_at: string | null })[]);
}

const RECENTLY_TEXTED_WINDOW_MS = 60 * 60 * 1000;

// Applied to every bulk-send audience (event, tag, or hand-picked contacts)
// right before it's shown or sent to - a contact who already got an
// outbound text in the last hour, from any source (an individual quick
// text, another blast), doesn't need the exact same reminder again a
// moment later. Matters most for the "text a few people individually,
// then bulk-blast the rest of the filtered list" workflow, where without
// this the bulk send would immediately re-text whoever she just handled
// by hand.
async function excludeRecentlyTexted(admin: SupabaseClient, ownerId: string, audience: AudienceContact[]): Promise<AudienceContact[]> {
  if (audience.length === 0) return audience;

  const cutoff = new Date(Date.now() - RECENTLY_TEXTED_WINDOW_MS).toISOString();
  const { data: recent } = await admin
    .from("activities")
    .select("contact_id")
    .eq("owner_id", ownerId)
    .eq("source", "quo")
    .eq("type", "text")
    .eq("direction", "outbound")
    .gte("occurred_at", cutoff)
    .in(
      "contact_id",
      audience.map((c) => c.id),
    );

  const recentlyTextedIds = new Set((recent ?? []).map((r) => r.contact_id as string));
  return audience.filter((c) => !recentlyTextedIds.has(c.id));
}

export type LastTextSnippet = TextThreadMessage;
export type TextBlastRecipient = {
  id: string;
  name: string;
  phone: string;
  duplicatePhone: boolean;
  duplicateName: boolean;
  noRealName: boolean;
  // Oldest first, like reading a thread top to bottom - see
  // fetchRecentTextsByContact for the window/cap.
  recentTexts: TextThreadMessage[];
};
export type TextBlastAudiencePreview = { count: number; recipients: TextBlastRecipient[]; optedOutCount: number; noNameCount: number };

// Full recipient list rather than a truncated sample - a "sending to 41
// people: Jamie, Alex +39 more" summary doesn't let her actually check who
// she's about to text, or catch two contact records that'd double-text the
// same real person before she hits send. duplicatePhone flags recipients
// who share a phone with another recipient in this same send (the send
// loop keys strictly off contact_id, so this WOULD fire twice); duplicateName
// flags a same-name collision even without a shared phone, since that's
// the more common shape a duplicate contact takes (re-entered with a typo'd
// or different number). noRealName flags a contact whose first_name is just
// their phone/email on file (never a real name) - if the message greets by
// {{first_name}}, the actual send loop skips these rather than texting "Hi
// 5739992048," but she should see who that affects before she even sends.
function buildAudiencePreview(audience: AudienceContact[], recentTextsByContact: Map<string, LastTextSnippet[]>, optedOutCount = 0): TextBlastAudiencePreview {
  const phoneCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  for (const c of audience) {
    phoneCounts.set(c.phone, (phoneCounts.get(c.phone) ?? 0) + 1);
    const normalizedName = `${c.first_name} ${c.last_name}`.trim().toLowerCase();
    nameCounts.set(normalizedName, (nameCounts.get(normalizedName) ?? 0) + 1);
  }

  let noNameCount = 0;
  const recipients = audience
    .map((c) => {
      const name = `${c.first_name} ${c.last_name}`.trim() || "Unnamed";
      const noRealName = hasPlaceholderName(c);
      if (noRealName) noNameCount++;
      return {
        id: c.id,
        name,
        phone: c.phone,
        duplicatePhone: (phoneCounts.get(c.phone) ?? 0) > 1,
        duplicateName: (nameCounts.get(name.toLowerCase()) ?? 0) > 1,
        noRealName,
        recentTexts: recentTextsByContact.get(c.id) ?? [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { count: audience.length, recipients, optedOutCount, noNameCount };
}

// What the compose modal is sending to - a tag's members, or a hand-picked
// slice of the Contacts list. A discriminated union rather than a pile of
// optional props, so the modal can't be opened in an ambiguous
// half-configured state. (The original app also had an "event" target
// kind here, blasting an event's registrants/attendees - intentionally
// excluded from this chassis, see README.)
export type BlastTarget = { kind: "tag"; tagId: string; tagName: string } | { kind: "contacts"; contactIds: string[]; label: string };

export async function getTagAudiencePreview(tagId: string): Promise<TextBlastAudiencePreview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { count: 0, recipients: [], optedOutCount: 0, noNameCount: 0 };

  const admin = createAdminClient();
  const { eligible, optedOutCount } = await resolveTagAudience(admin, user.id, tagId);
  const audience = await excludeRecentlyTexted(admin, user.id, eligible);
  const recentTextsByContact = await fetchRecentTextsByContact(admin, user.id, audience.map((c) => c.id));
  return buildAudiencePreview(audience, recentTextsByContact, optedOutCount);
}

export async function createTagTextBlast(tagId: string, tagName: string, message: string, excludeContactIds: string[] = [], sendImmediately = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!message.trim()) return { ok: false as const, error: "Write a message" };

  const admin = createAdminClient();
  const { eligible } = await resolveTagAudience(admin, user.id, tagId);
  const excludeSet = new Set(excludeContactIds);
  const audience = (await excludeRecentlyTexted(admin, user.id, eligible)).filter((c) => !excludeSet.has(c.id));
  if (!audience.length) return { ok: false as const, error: "No one left to text in this audience - see who's opted out, already texted, or removed from this send" };

  const { data: blast, error: blastError } = await admin
    .from("text_blasts")
    .insert({ owner_id: user.id, event_name: tagBlastLabel(tagName), message: message.trim(), tag_id: tagId, send_immediately: sendImmediately })
    .select("id")
    .single();
  if (blastError || !blast) return { ok: false as const, error: blastError?.message ?? "Failed to create blast" };

  await admin.from("text_blast_recipients").insert(audience.map((c) => ({ blast_id: blast.id, contact_id: c.id })));

  return { ok: true as const, blastId: blast.id as string, recipientCount: audience.length };
}

export async function getContactsAudiencePreview(contactIds: string[]): Promise<TextBlastAudiencePreview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { count: 0, recipients: [], optedOutCount: 0, noNameCount: 0 };

  const admin = createAdminClient();
  const { eligible, optedOutCount } = await resolveContactsAudience(admin, user.id, contactIds);
  const audience = await excludeRecentlyTexted(admin, user.id, eligible);
  const recentTextsByContact = await fetchRecentTextsByContact(admin, user.id, audience.map((c) => c.id));
  return buildAudiencePreview(audience, recentTextsByContact, optedOutCount);
}

export async function createContactsTextBlast(contactIds: string[], label: string, message: string, excludeContactIds: string[] = [], sendImmediately = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!message.trim()) return { ok: false as const, error: "Write a message" };

  const admin = createAdminClient();
  const { eligible } = await resolveContactsAudience(admin, user.id, contactIds);
  const excludeSet = new Set(excludeContactIds);
  const audience = (await excludeRecentlyTexted(admin, user.id, eligible)).filter((c) => !excludeSet.has(c.id));
  if (!audience.length) return { ok: false as const, error: "No one left to text in this audience - see who's opted out, already texted, or removed from this send" };

  const { data: blast, error: blastError } = await admin
    .from("text_blasts")
    .insert({ owner_id: user.id, event_name: label, message: message.trim(), send_immediately: sendImmediately })
    .select("id")
    .single();
  if (blastError || !blast) return { ok: false as const, error: blastError?.message ?? "Failed to create blast" };

  await admin.from("text_blast_recipients").insert(audience.map((c) => ({ blast_id: blast.id, contact_id: c.id })));

  return { ok: true as const, blastId: blast.id as string, recipientCount: audience.length };
}

export async function sendTestText(message: string, phone: string) {
  if (!phone.trim()) return { ok: false as const, error: "Enter a phone number" };
  if (!message.trim()) return { ok: false as const, error: "Write a message first" };

  const body = applyMergeFields(message, PREVIEW_CONTACT);
  const result = await sendQuoText(phone.trim(), body);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const, sentBody: body };
}

export async function cancelTextBlast(blastId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.from("text_blast_recipients").update({ status: "skipped" }).eq("blast_id", blastId).eq("status", "pending");
  await admin.from("text_blasts").update({ status: "canceled", completed_at: new Date().toISOString() }).eq("id", blastId).eq("owner_id", user.id);
}

// Requeues every failed recipient as pending and reopens the blast so the
// cron picks it back up - for exactly the "Quo ran out of credits, topped
// up, now catch up the ones that bounced" case, without re-sending to
// anyone who already got it.
export async function retryFailedTextBlastRecipients(blastId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();

  const { count } = await admin
    .from("text_blast_recipients")
    .update({ status: "pending", error: null }, { count: "exact" })
    .eq("blast_id", blastId)
    .eq("status", "failed");

  await admin.from("text_blasts").update({ status: "sending", completed_at: null }).eq("id", blastId).eq("owner_id", user.id);

  return { ok: true as const, retried: count ?? 0 };
}

export type { TextBlastWithProgress };

export async function getTextBlastsForEvent(eventName: string): Promise<TextBlastWithProgress[]> {
  const supabase = await createClient();
  const { data: blasts } = await supabase
    .from("text_blasts")
    .select("*")
    .eq("event_name", eventName)
    .order("created_at", { ascending: false })
    .limit(10);
  if (!blasts?.length) return [];

  const { data: recipients } = await supabase
    .from("text_blast_recipients")
    .select("blast_id, status")
    .in(
      "blast_id",
      blasts.map((b) => b.id),
    );

  return withProgress(blasts, recipients ?? []);
}

// All-time history across every event, newest first - the Text tab's
// standalone home (moved out from under Contacts/one-event-at-a-time), so
// she can see and reopen any past send regardless of which event it was for.
export async function getAllTextBlasts(): Promise<TextBlastWithProgress[]> {
  const supabase = await createClient();
  const { data: blasts } = await supabase.from("text_blasts").select("*").order("created_at", { ascending: false }).limit(50);
  if (!blasts?.length) return [];

  const { data: recipients } = await supabase
    .from("text_blast_recipients")
    .select("blast_id, status")
    .in(
      "blast_id",
      blasts.map((b) => b.id),
    );

  return withProgress(blasts, recipients ?? []);
}

export type TextBlastFailureGroup = { error: string; count: number; sample: { name: string; phone: string | null }[] };

// Grouped by the actual error text (rather than one row per person) so a
// systemic problem - the same Quo error on every failure - reads as one
// clear reason instead of a wall of identical-looking rows. sample caps at
// 5 names per group so a "who exactly" spot-check doesn't need a DB query.
export async function getTextBlastFailureDetails(blastId: string): Promise<TextBlastFailureGroup[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("text_blast_recipients")
    .select("error, contacts(first_name, last_name, phone)")
    .eq("blast_id", blastId)
    .eq("status", "failed");

  const groups = new Map<string, TextBlastFailureGroup>();
  for (const row of (rows ?? []) as unknown as { error: string | null; contacts: { first_name: string; last_name: string; phone: string | null } | null }[]) {
    const error = row.error ?? "Unknown error";
    const group = groups.get(error) ?? { error, count: 0, sample: [] };
    group.count++;
    if (group.sample.length < 5 && row.contacts) {
      group.sample.push({ name: [row.contacts.first_name, row.contacts.last_name].filter(Boolean).join(" "), phone: row.contacts.phone });
    }
    groups.set(error, group);
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}
