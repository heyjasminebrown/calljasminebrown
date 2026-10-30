"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractStoredTranscriptText } from "@/lib/granola/parse-event";
import { rememberNameMatch } from "@/lib/crm/note-name-match";
import { runExtraction } from "@/lib/data/meeting-transcripts";

// Shared by both "That's her" and "New contact from this note" - once a
// transcript has a contact_id, it's handled exactly the same way the
// webhook handles a fresh match: known-personally gets no proposals,
// everyone else gets the same extraction/panel pipeline. Awaited directly
// rather than deferred with after() - unlike a webhook, there's no HTTP
// response she's waiting on to return fast, she's sitting on this screen
// watching for the result.
async function matchAndExtract(ownerId: string, transcriptId: string, contactId: string) {
  const admin = createAdminClient();

  const [{ data: transcript }, { data: contact }] = await Promise.all([
    admin.from("meeting_transcripts").select("raw_payload, participants").eq("id", transcriptId).maybeSingle(),
    admin.from("contacts").select("known_personally").eq("id", contactId).maybeSingle(),
  ]);
  if (!transcript) return { ok: false as const, error: "Note not found" };

  await admin.from("meeting_transcripts").update({ contact_id: contactId }).eq("id", transcriptId);

  if (contact?.known_personally) {
    await admin.from("meeting_transcripts").update({ status: "no_proposals" }).eq("id", transcriptId);
    return { ok: true as const };
  }

  // Participant names come from the row's own already-parsed `participants`
  // column (set correctly at creation time - see createOrGetTranscript),
  // not a re-parse of raw_payload, which is shaped differently depending on
  // how the note's content originally arrived (see extractStoredTranscriptText).
  const transcriptText = extractStoredTranscriptText(transcript.raw_payload as Record<string, unknown>);
  const participants = (transcript.participants ?? []) as { name: string | null }[];
  const participantNames = participants.map((p) => p.name).filter((n): n is string => !!n);
  await runExtraction(admin, ownerId, transcriptId, contactId, transcriptText, participantNames);
  return { ok: true as const };
}

export async function matchNoteToContact(transcriptId: string, contactId: string, confirmedName?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (confirmedName) await rememberNameMatch(createAdminClient(), user.id, confirmedName, contactId);

  return matchAndExtract(user.id, transcriptId, contactId);
}

export async function createContactFromNote(transcriptId: string, firstName: string, lastName: string, email: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  const { data: firstStage } = await admin
    .from("pipeline_stages")
    .select("id")
    .eq("owner_id", user.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await admin
    .from("contacts")
    .insert({
      owner_id: user.id,
      first_name: firstName.trim() || "Unknown",
      last_name: lastName.trim(),
      email,
      contact_type: "other",
      lead_source: "Granola note (new contact)",
      stage_id: firstStage?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false as const, error: "Couldn't create the contact" };

  return matchAndExtract(user.id, transcriptId, created.id);
}
