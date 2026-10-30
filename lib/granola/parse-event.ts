// Granola's own account settings let her point a webhook straight at us -
// no Zapier/Make relay in between, so unlike Tactiq this parses Granola's
// actual native payload shape rather than one we invented for her to map
// into. Confirmed against real deliveries: the webhook body itself is a
// thin notification ({event_id, note_id, occurred_at, event_type}), never
// the transcript - the route falls back to fetching the note from
// Granola's API (lib/granola/client.ts) when this comes back empty. The
// noteId/title/calendarEventId/participants fields below are still read
// defensively across a few plausible key-name variants for whatever a
// content-carrying webhook event (if Granola ever sends one) might use,
// and the route logs the full raw body whenever something required is
// missing - the same "log it so we can fix the guess" approach used for
// Quo's signature header.
export type GranolaNoteEvent = {
  noteId: string;
  title: string;
  transcript: string;
  // Granola's own AI-generated recap of the note - what actually gets
  // logged as the contact's "Notes" timeline entry (see process-note.ts).
  // The full transcript is kept around for extraction only; it's too long
  // to be a readable history entry on its own.
  summary: string;
  occurredAt: string;
  durationSeconds: number | null;
  calendarEventId: string | null;
  participants: { name: string | null; email: string | null }[];
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Granola's payload is more likely to carry start/end timestamps than a
// plain duration - if both parse as dates, use their difference; a direct
// duration_seconds field (if present) always wins.
function computeDuration(body: Record<string, unknown>): number | null {
  const direct = asNumber(pick(body, "duration_seconds", "durationSeconds"));
  if (direct != null) return direct;

  const start = asString(pick(body, "start_time", "startTime"));
  const end = asString(pick(body, "end_time", "endTime"));
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 1000);
}

function pick(body: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null) return body[key];
  }
  return undefined;
}

// meeting_transcripts.raw_payload's actual shape depends on how the note's
// content reached processGranolaNote (see process-note.ts): {note:
// GranolaNote} from the manual backfill, {webhook: <original body>, note:
// GranolaNote} from the live webhook once it had to fetch the content via
// the API - which per the comment above is true for essentially every
// note, since the webhook body itself never carries the transcript. Only
// the (seemingly unused in practice) case where a webhook payload directly
// carried the transcript stores the flat body as-is. Re-parsing raw_payload
// with parseGranolaEvent as if it were always that flat shape silently
// produced an empty transcript for almost every stored note (Get Note's
// field is transcriptText, nested under raw_payload.note, not a top-level
// "transcript" key) - this recovers the real shape first, wherever the
// caller needs the actual transcript text back out of a saved row (the
// Notes inbox preview, and re-running extraction once she manually matches
// a contact).
export function extractStoredTranscriptText(rawPayload: Record<string, unknown>): string {
  const note = rawPayload.note as { transcriptText?: string | null } | undefined;
  if (note?.transcriptText) return note.transcriptText;
  const webhookBody = (rawPayload.webhook as Record<string, unknown> | undefined) ?? rawPayload;
  return parseGranolaEvent(webhookBody).transcript;
}

// Same recovery as extractStoredTranscriptText, for Granola's own summary
// (Get Note's "summary" field) instead of the transcript.
export function extractStoredSummary(rawPayload: Record<string, unknown>): string {
  const note = rawPayload.note as { summary?: string | null } | undefined;
  if (note?.summary) return note.summary;
  const webhookBody = (rawPayload.webhook as Record<string, unknown> | undefined) ?? rawPayload;
  return parseGranolaEvent(webhookBody).summary;
}

export function parseGranolaEvent(body: Record<string, unknown>): GranolaNoteEvent {
  const rawAttendees = pick(body, "attendees", "participants");
  const attendeeList = Array.isArray(rawAttendees) ? rawAttendees : [];
  const participants = attendeeList
    .map((p) => {
      if (typeof p === "string") return { name: null, email: asString(p) ?? null };
      if (p && typeof p === "object") {
        const obj = p as Record<string, unknown>;
        return { name: asString(pick(obj, "name", "display_name")), email: asString(pick(obj, "email", "email_address")) };
      }
      return null;
    })
    .filter((p): p is { name: string | null; email: string | null } => !!p);

  return {
    noteId: asString(pick(body, "note_id", "noteId", "id")) ?? "",
    title: asString(pick(body, "title", "meeting_title")) ?? "Meeting",
    transcript: asString(pick(body, "transcript", "transcript_text")) ?? "",
    summary: asString(pick(body, "summary")) ?? "",
    occurredAt: asString(pick(body, "occurred_at", "start_time", "startTime", "date", "created_at")) ?? new Date().toISOString(),
    durationSeconds: computeDuration(body),
    calendarEventId: asString(pick(body, "calendar_event_id", "calendarEventId")),
    participants,
  };
}
