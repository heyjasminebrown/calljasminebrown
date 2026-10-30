import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseGranolaEvent } from "@/lib/granola/parse-event";
import { fetchGranolaNote } from "@/lib/granola/client";
import { processGranolaNote } from "@/lib/granola/process-note";

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Granola is pointed straight at this URL from its own settings - no
  // Zapier/Make relay, so there's no signing header to verify either.
  // Same secret-in-URL pattern as Eventbrite/Jotform.
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.GRANOLA_WEBHOOK_SECRET || secret !== process.env.GRANOLA_WEBHOOK_SECRET) {
    console.error("Granola webhook rejected: missing/incorrect secret");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!OWNER_ID) {
    console.error("Granola webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    // Confirmed from a real delivery: Granola's own connectivity check from
    // its webhook settings page ("Test it" there, not this app's Settings
    // button) sends {event_type: "webhook.test", event_id, occurred_at} -
    // no note_id, on purpose, since it isn't about a real note. Treating
    // that as a malformed payload made Granola's own dashboard show every
    // connectivity test as a failure.
    if (body.event_type === "webhook.test") {
      return NextResponse.json({ received: true });
    }

    const event = parseGranolaEvent(body);
    let fetchedNote: Awaited<ReturnType<typeof fetchGranolaNote>> = null;

    if (!event.noteId) {
      // No stable id means no reliable dedupe - log the raw payload so we
      // can see Granola's real field name for this and fix parse-event.ts.
      console.error("Granola webhook missing a note id - check the payload shape", body);
      return NextResponse.json({ error: "missing note id" }, { status: 400 });
    }
    if (!event.transcript) {
      // Confirmed against real deliveries (not a guess): Granola's webhook
      // never carries the transcript itself, just a thin "this note
      // changed" notification - fetch the real content from their API
      // using the note id instead.
      if (!process.env.GRANOLA_API_KEY) {
        console.log("Granola webhook has no transcript and GRANOLA_API_KEY isn't set, so it can't be fetched - skipping", event.noteId, body);
        return NextResponse.json({ received: true });
      }

      let note: Awaited<ReturnType<typeof fetchGranolaNote>>;
      try {
        note = await fetchGranolaNote(event.noteId);
      } catch (err) {
        console.error("Granola API error fetching note content", event.noteId, err);
        return NextResponse.json({ received: true });
      }

      if (!note || !note.transcriptText) {
        // Granola 404s Get Note until it has a generated summary +
        // transcript (per their docs) - not ready yet, not a failure.
        // Another event fires once it is, and this note gets picked up
        // then.
        console.log("Granola note isn't ready yet (no transcript from the API) - will pick it up on a later event", event.noteId);
        return NextResponse.json({ received: true });
      }

      event.transcript = note.transcriptText;
      if (note.summary) event.summary = note.summary;
      if (note.title) event.title = note.title;
      if (note.calendarEventId) event.calendarEventId = note.calendarEventId;
      if (note.participants.length > 0) event.participants = note.participants;
      fetchedNote = note;
    }

    await processGranolaNote(admin, OWNER_ID, event, fetchedNote ? { webhook: body, note: fetchedNote } : body);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Error processing Granola webhook", err);
    return NextResponse.json({ received: true });
  }
}
