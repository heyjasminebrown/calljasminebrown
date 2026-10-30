"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { quoFetch } from "@/lib/quo/client";
import { patchActivityMetadata } from "@/lib/crm/activities";
import { setSpamRuleEnabled, detectSpam, isNumberAllowlisted, getDisabledSpamReasons, MISSED_STATUSES } from "@/lib/crm/spam-signals";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleSpamRule(reason: string, enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  await setSpamRuleEnabled(supabase, user.id, reason, enabled);
  revalidatePath("/settings");
  return { ok: true };
}

// Removes a number from the allowlist - the rules above can flag it again
// on its next call, same as any number that was never marked "Not spam."
export async function removeSpamAllowlistEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("spam_number_allowlist").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

type BackfillResult =
  | { ok: true; checked: number; recovered: number; flaggedSpam: number; stillMissing: number }
  | { ok: false; error: string };

// One-time catch-up for calls that arrived before parseQuoCall knew to read
// call.completed's nested `voicemail` object: those calls kept the ID Quo
// gave the call, but never got a recording_url/transcript saved, so they
// never had any text for the spam keyword rules to match against. Re-pulls
// each one straight from Quo's own /call-voicemails/{callId} endpoint (the
// same voicemail data call.completed should have delivered inline) and
// re-runs spam detection now that real text exists to check.
export async function backfillMissedVoicemails(): Promise<BackfillResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient();
  const { data: candidates } = await admin
    .from("activities")
    .select("dedupe_value, contact_id, metadata")
    .eq("owner_id", user.id)
    .eq("source", "quo")
    .eq("type", "call")
    .eq("dedupe_field", "quo_call_id")
    .is("metadata->>recording_url", null)
    .not("dedupe_value", "is", null);

  const missed = (candidates ?? []).filter((a) => {
    const status = typeof a.metadata?.status === "string" ? a.metadata.status.toLowerCase() : null;
    return status != null && MISSED_STATUSES.has(status);
  });

  let recovered = 0;
  let flaggedSpam = 0;
  let stillMissing = 0;

  for (const activity of missed) {
    const callId = activity.dedupe_value as string;

    const res = await quoFetch(`/call-voicemails/${callId}`, { method: "GET" }).catch(() => null);
    if (!res || !res.ok) {
      stillMissing++;
      continue;
    }

    const body = await res.json().catch(() => null);
    const voicemail = body?.data as Record<string, unknown> | null | undefined;
    const recordingUrl = typeof voicemail?.recordingUrl === "string" ? voicemail.recordingUrl : null;
    const transcript = typeof voicemail?.transcript === "string" ? voicemail.transcript : null;

    // Quo returns the record with null fields while the voicemail is still
    // processing (see the voicemail object's own `status`) - nothing to
    // save yet, try again later rather than writing empty values.
    if (!recordingUrl && !transcript) {
      stillMissing++;
      continue;
    }

    const result = await patchActivityMetadata(admin, user.id, "quo", "quo_call_id", callId, {
      recording_url: recordingUrl ?? undefined,
      transcript: transcript ?? undefined,
    });
    if (!result) {
      stillMissing++;
      continue;
    }
    recovered++;

    const { data: contact } = await admin.from("contacts").select("spam, phone").eq("id", result.contactId).maybeSingle();
    if (!contact || contact.spam) continue;
    if (await isNumberAllowlisted(admin, user.id, contact.phone)) continue;

    const disabledReasons = await getDisabledSpamReasons(admin, user.id);
    const status = typeof activity.metadata?.status === "string" ? (activity.metadata.status as string) : null;
    const summary = typeof activity.metadata?.summary === "string" ? (activity.metadata.summary as string) : null;
    const durationSeconds = typeof activity.metadata?.duration_seconds === "number" ? (activity.metadata.duration_seconds as number) : null;

    const spamCheck = detectSpam({
      summary,
      transcript,
      durationSeconds,
      status,
      hasVoicemail: !!recordingUrl,
      disabledReasons,
    });

    if (spamCheck.isSpam) {
      await patchActivityMetadata(admin, user.id, "quo", "quo_call_id", callId, {
        spam_reason: spamCheck.reason,
        spam_detected_at: new Date().toISOString(),
      });
      await admin.from("contacts").update({ spam: true }).eq("id", result.contactId);
      flaggedSpam++;
    }
  }

  revalidatePath("/settings");
  revalidatePath("/messages");
  return { ok: true, checked: missed.length, recovered, flaggedSpam, stillMissing };
}

type RecheckResult = { ok: true; checked: number; flaggedSpam: number } | { ok: false; error: string };

// Whenever a spam rule gets a new pattern (or a new rule entirely), calls
// that already have a transcript/summary saved - the voicemail backfill
// above already pulled it in, or a normal call.transcript.completed
// delivered it - never get re-matched against the update on their own.
// Runs every non-spam Quo call with any transcript/summary text back
// through detectSpam so a rule change catches what it was meant to catch
// without needing another round-trip to Quo.
export async function recheckSpamRules(): Promise<RecheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("activities")
    .select("dedupe_value, contact_id, metadata")
    .eq("owner_id", user.id)
    .eq("source", "quo")
    .eq("type", "call");

  // No direction filter: a robocall's own transcript is what we're
  // matching on, not which way the call went - a stray "none" instead of
  // "inbound" (parseQuoCall falls back to "none" for anything it doesn't
  // recognize - see its comment) would silently drop every real spam call
  // from this list with no error at all, so there's nothing to gain from
  // filtering on it here.
  const candidates = (rows ?? []).filter((a) => {
    const metadata = a.metadata as Record<string, unknown> | null;
    return typeof metadata?.transcript === "string" || typeof metadata?.summary === "string";
  });

  const disabledReasons = await getDisabledSpamReasons(admin, user.id);
  let checked = 0;
  let flaggedSpam = 0;

  for (const activity of candidates) {
    const { data: contact } = await admin.from("contacts").select("spam, phone").eq("id", activity.contact_id).maybeSingle();
    if (!contact || contact.spam) continue;
    if (await isNumberAllowlisted(admin, user.id, contact.phone)) continue;

    checked++;
    const metadata = activity.metadata as Record<string, unknown> | null;
    const spamCheck = detectSpam({
      summary: typeof metadata?.summary === "string" ? metadata.summary : null,
      transcript: typeof metadata?.transcript === "string" ? metadata.transcript : null,
      durationSeconds: typeof metadata?.duration_seconds === "number" ? metadata.duration_seconds : null,
      status: typeof metadata?.status === "string" ? metadata.status : null,
      hasVoicemail: typeof metadata?.recording_url === "string" && !!metadata.recording_url,
      disabledReasons,
    });

    if (spamCheck.isSpam) {
      await patchActivityMetadata(admin, user.id, "quo", "quo_call_id", activity.dedupe_value as string, {
        spam_reason: spamCheck.reason,
        spam_detected_at: new Date().toISOString(),
      });
      await admin.from("contacts").update({ spam: true }).eq("id", activity.contact_id);
      flaggedSpam++;
    }
  }

  revalidatePath("/settings");
  revalidatePath("/messages");
  return { ok: true, checked, flaggedSpam };
}
