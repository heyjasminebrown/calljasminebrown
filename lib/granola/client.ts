// Granola's webhook only ever sends a thin "this happened" notification
// (confirmed against real deliveries - see route.ts's own comment) - the
// actual note content has to be pulled separately via this REST API, the
// same shape as Eventbrite's fetchEventDetails following up a webhook that
// only hands us an id. Confirmed against Granola's own published API docs
// (docs.granola.ai/api-reference), not a guess like parse-event.ts's
// webhook field names had to be.
const BASE_URL = "https://public-api.granola.ai/v1";

export type GranolaTranscriptTurn = {
  speaker: { source?: string; diarization_label?: string } | null;
  text: string;
};

export type GranolaNote = {
  id: string;
  title: string | null;
  summary: string | null;
  transcriptText: string | null;
  // The docs' quick-start example elides most of the Get Note/List Notes
  // response behind "..." - whether it carries calendar/attendee/date
  // fields at all (and under what name) isn't confirmed, so these are read
  // defensively across a few plausible key names, same posture as
  // parse-event.ts.
  occurredAt: string | null;
  calendarEventId: string | null;
  participants: { name: string | null; email: string | null }[];
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function turnsToText(turns: unknown): string | null {
  if (!Array.isArray(turns)) return null;
  const lines = (turns as GranolaTranscriptTurn[])
    .map((turn) => {
      const text = asString(turn?.text);
      if (!text) return null;
      const label = asString(turn?.speaker?.diarization_label);
      return label ? `${label}: ${text}` : text;
    })
    .filter((l): l is string => !!l);
  return lines.length > 0 ? lines.join("\n") : null;
}

function parseParticipants(body: Record<string, unknown>): { name: string | null; email: string | null }[] {
  const raw = pick(body, "attendees", "participants", "people");
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === "string") return { name: null, email: asString(p) };
      if (p && typeof p === "object") {
        const obj = p as Record<string, unknown>;
        return { name: asString(pick(obj, "name", "display_name")), email: asString(pick(obj, "email", "email_address")) };
      }
      return null;
    })
    .filter((p): p is { name: string | null; email: string | null } => !!p);
}

async function granolaFetch(path: string): Promise<Response> {
  const apiKey = process.env.GRANOLA_API_KEY;
  if (!apiKey) throw new Error("GRANOLA_API_KEY is not configured");
  return fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
}

// null return = "not ready yet" (Granola 404s Get Note until it has a
// generated summary + transcript, per their docs) - not an error, just not
// there yet. Caller should skip quietly and wait for a later event.
export async function fetchGranolaNote(noteId: string): Promise<GranolaNote | null> {
  const res = await granolaFetch(`/notes/${encodeURIComponent(noteId)}?include=transcript`);

  if (res.status === 404) return null;

  if (res.status === 413) {
    // Docs: transcript too large for the inline response - the full thing
    // lives at this separate endpoint instead.
    const noteRes = await granolaFetch(`/notes/${encodeURIComponent(noteId)}`);
    if (!noteRes.ok) throw new Error(`Granola API error fetching note ${noteId} (${noteRes.status}): ${await noteRes.text()}`);
    const note = await noteRes.json();

    const transcriptRes = await granolaFetch(`/notes/${encodeURIComponent(noteId)}/transcript`);
    if (!transcriptRes.ok) throw new Error(`Granola API error fetching transcript for ${noteId} (${transcriptRes.status}): ${await transcriptRes.text()}`);
    const transcriptBody = await transcriptRes.json();
    const turns = Array.isArray(transcriptBody) ? transcriptBody : pick(transcriptBody, "transcript", "turns");

    return {
      id: noteId,
      title: asString(note.title),
      summary: asString(note.summary),
      transcriptText: turnsToText(turns),
      occurredAt: asString(pick(note, "created_at", "createdAt", "occurred_at", "date")),
      calendarEventId: asString(pick(note, "calendar_event_id", "google_calendar_event_id", "calendarEventId")),
      participants: parseParticipants(note),
    };
  }

  if (!res.ok) throw new Error(`Granola API error fetching note ${noteId} (${res.status}): ${await res.text()}`);

  const note = await res.json();
  return {
    id: noteId,
    title: asString(note.title),
    summary: asString(note.summary),
    transcriptText: turnsToText(note.transcript),
    occurredAt: asString(pick(note, "created_at", "createdAt", "occurred_at", "date")),
    calendarEventId: asString(pick(note, "calendar_event_id", "google_calendar_event_id", "calendarEventId")),
    participants: parseParticipants(note),
  };
}

// For the manual "sync recent notes" backfill button in Settings - lists
// note ids created since a given time, paginating via the cursor the docs
// describe, then each id gets fetched individually with fetchGranolaNote
// above (which already handles the 413/404 cases) rather than trying to
// parse a second, differently-shaped bulk response - simpler and reuses
// already-tested code, at the cost of one extra request per note, which is
// fine at this account's note volume and well under Granola's documented
// rate limit (300/minute).
export async function listGranolaNoteIds(createdAfter: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;

  do {
    const qs = new URLSearchParams({ created_after: createdAfter });
    if (cursor) qs.set("cursor", cursor);
    const res = await granolaFetch(`/notes?${qs.toString()}`);
    if (!res.ok) throw new Error(`Granola API error listing notes (${res.status}): ${await res.text()}`);

    const body = await res.json();
    const notes = Array.isArray(body?.notes) ? body.notes : [];
    for (const n of notes) {
      const id = asString(n?.id);
      if (id) ids.push(id);
    }
    cursor = body?.hasMore ? (asString(body?.cursor) ?? undefined) : undefined;
  } while (cursor);

  return ids;
}
