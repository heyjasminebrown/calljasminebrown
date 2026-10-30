import type { SupabaseClient } from "@supabase/supabase-js";
import { matchByCalendarEventId, matchByAttendeeEmail } from "@/lib/crm/meeting-match";
import { findNameCandidates, matchByRememberedName, getGranolaMatchingRules } from "@/lib/crm/note-name-match";
import { createOrGetTranscript, runExtraction } from "@/lib/data/meeting-transcripts";
import { upsertActivity } from "@/lib/crm/activities";
import type { TranscriptParticipant } from "@/types/database";
import type { GranolaNoteEvent } from "@/lib/granola/parse-event";

// Shared between the live webhook (one note at a time, called as soon as
// its content is available) and the manual "sync recent notes" backfill
// button in Settings (many notes at once), so both paths match/create/
// extract identically instead of drifting apart - same shape as
// processEventbriteOrder. Callers are responsible for making sure
// event.transcript is actually populated before calling this.
export async function processGranolaNote(
  admin: SupabaseClient,
  ownerId: string,
  event: GranolaNoteEvent,
  rawPayload: Record<string, unknown>,
): Promise<{ wasCreated: boolean }> {
  const rules = await getGranolaMatchingRules(admin, ownerId);

  // A video meeting (Zoom/Meet/Teams) carries a calendar event id the same
  // way a Tactiq meeting did - match on that first (toggle-gated). An
  // in-person coffee or a phone call has neither, and falls through to the
  // attendee-email match, then a remembered "That's her" name, then a live
  // name-in-note match if exactly one contact's full name shows up in the
  // transcript (also toggle-gated - an ambiguous 2+ match is deliberately
  // left unmatched for the Notes inbox to ask about, never auto-resolved
  // to a guess).
  let contactId =
    (rules.match_on_calendar_event && event.calendarEventId ? await matchByCalendarEventId(admin, ownerId, event.calendarEventId) : null) ??
    (await matchByAttendeeEmail(
      admin,
      ownerId,
      event.participants.map((p) => p.email).filter((e): e is string => !!e),
    )) ??
    (await matchByRememberedName(admin, ownerId, event.transcript));

  if (!contactId && rules.match_on_name_when_single) {
    const { data: contacts } = await admin.from("contacts").select("id, first_name, last_name").eq("owner_id", ownerId).eq("archived", false);
    const candidates = findNameCandidates(contacts ?? [], event.transcript);
    if (candidates.length === 1) contactId = candidates[0].id;
  }

  const participants: TranscriptParticipant[] = await Promise.all(
    event.participants.map(async (p) => {
      if (!p.email) return { name: p.name, email: null, isContact: false, contactId: null };
      const matchedId = await matchByAttendeeEmail(admin, ownerId, [p.email]);
      return { name: p.name, email: p.email, isContact: !!matchedId, contactId: matchedId };
    }),
  );

  const { id: transcriptId, wasCreated } = await createOrGetTranscript(admin, {
    ownerId,
    contactId,
    source: "granola",
    externalId: event.noteId,
    rawPayload,
    participants,
    durationSeconds: event.durationSeconds,
    occurredAt: event.occurredAt,
  });

  // Unmatched (in-person coffee, phone call, or a video meeting nobody
  // recognized) - still saved, surfaces in the Notes inbox, nothing lost
  // either way.
  if (!contactId) return { wasCreated };

  // Granola's own AI recap becomes a "meeting" activity on the contact's
  // timeline (the Notes filter, alongside calls/texts/emails) - the full
  // transcript is far too long for a readable history entry, this is what
  // she actually wants to skim back through later. Logged even for a
  // contact she knows personally (known_personally only gates automated
  // AI *suggestions* below, not the plain record that a meeting happened).
  // Not gated on wasCreated, and upsertActivity dedupes on the note id, so
  // re-running "Sync recent notes" also backfills this for meetings that
  // were already matched before this existed.
  await upsertActivity(admin, ownerId, contactId, "granola", "granola_note_id", event.noteId, {
    type: "meeting",
    direction: "none",
    occurred_at: event.occurredAt,
    body: event.summary || event.title,
    // ActivityTimeline already renders a "Transcript" expand/collapse for
    // any activity carrying metadata.transcript (built for Quo calls) -
    // reusing that same field here, rather than a separate mechanism,
    // gets the same affordance for free on a Granola note.
    metadata: { granola_note_id: event.noteId, transcript: event.transcript || null },
  });

  if (!wasCreated) return { wasCreated: false };

  const { data: contact } = await admin.from("contacts").select("known_personally").eq("id", contactId).maybeSingle();
  if (contact?.known_personally) {
    await admin.from("meeting_transcripts").update({ status: "no_proposals" }).eq("id", transcriptId);
    return { wasCreated: true };
  }

  const participantNames = event.participants.map((p) => p.name).filter((n): n is string => !!n);
  await runExtraction(admin, ownerId, transcriptId, contactId, event.transcript, participantNames);

  return { wasCreated: true };
}
