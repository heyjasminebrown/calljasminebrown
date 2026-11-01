import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQuoSignature } from "@/lib/quo/verify-signature";
import { parseQuoCall, parseQuoMessage } from "@/lib/quo/parse-event";
import { findOrCreateContact } from "@/lib/crm/find-or-create-contact";
import { upsertActivity, patchActivityMetadata } from "@/lib/crm/activities";
import { analyzeContactActivity } from "@/lib/ai/analyze-contact";
import { createOrGetTranscript, runExtraction } from "@/lib/data/meeting-transcripts";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { recordOptOut, isOptOutMessage } from "@/lib/crm/consent";
import { isIncludedQuoNumber } from "@/lib/quo/phone-filter";
import { detectSpam, isNumberAllowlisted, hasRecentMissedCallBurst, getDisabledSpamReasons, type SpamCheckResult } from "@/lib/crm/spam-signals";
import { reportFailure } from "@/lib/errors/report-failure";
import { warmColdProspectOnReply } from "@/lib/crm/warm-on-reply";

// Extraction (a Claude call over the full transcript) runs after the
// response via after() below, but the function invocation itself still
// needs to stay alive long enough for that background work to finish -
// same reason send-sequences' cron raises this.
export const maxDuration = 60;

const OWNER_ID = process.env.CRM_OWNER_USER_ID;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const { ok, reason } = verifyQuoSignature(rawBody, request.headers);
  if (reason) {
    // Dump every header whenever verification is inconclusive so we can
    // find Quo's actual signature header name/format from a real delivery
    // and correct lib/quo/verify-signature.ts to match.
    console.warn("Quo webhook signature not verified:", reason, {
      headers: Object.fromEntries(request.headers.entries()),
    });
  }
  if (!ok) {
    await reportFailure("Quo webhook rejected: signature check failed", reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!OWNER_ID) {
    await reportFailure("Quo webhook received but CRM_OWNER_USER_ID is not configured");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const eventType = typeof body.type === "string" ? body.type : "unknown";
  const admin = createAdminClient();
  console.log("Quo webhook received:", eventType);

  try {
    if (eventType === "call.completed") {
      const call = parseQuoCall(body);
      if (!isIncludedQuoNumber(call.ownNumber)) {
        return NextResponse.json({ received: true, skipped: "excluded phone number" });
      }

      const contact = await findOrCreateContact(admin, OWNER_ID, {
        phone: call.counterpartNumber,
        leadSource: "Quo (auto-created from call)",
      });
      if (!contact) {
        await reportFailure(
          call.counterpartNumber
            ? `Quo call from ${call.counterpartNumber} wasn't logged: couldn't match or create a contact`
            : "Quo call wasn't logged: no phone number found in Quo's webhook payload",
          { counterpart: call.counterpartNumber, raw: JSON.stringify(body) },
        );
      }
      if (contact) {
        const spamCheck = await checkCallForSpam(admin, OWNER_ID, call);

        await upsertActivity(admin, OWNER_ID, contact.id, "quo", "quo_call_id", call.quoCallId, {
          type: "call",
          direction: call.direction,
          occurred_at: call.occurredAt,
          body: describeCall(call),
          metadata: {
            quo_call_id: call.quoCallId,
            quo_event_type: eventType,
            status: call.status,
            duration_seconds: call.durationSeconds,
            recording_url: call.recordingUrl,
            summary: call.summary,
            transcript: call.transcript,
            raw: body,
            ...(spamCheck.isSpam ? { spam_reason: spamCheck.reason, spam_detected_at: new Date().toISOString() } : {}),
          },
        });

        // A spam call skips the whole engagement pipeline entirely - no
        // engagement tag, and (below, at the transcript stage) no AI
        // extraction - rather than just hiding it from the inbox after the
        // fact.
        if (spamCheck.isSpam) {
          await admin.from("contacts").update({ spam: true }).eq("id", contact.id);
        } else {
          await updateEngagementTag(admin, OWNER_ID, contact.id);
        }
      }
    } else if (
      eventType === "call.recording.completed" ||
      eventType === "call.summary.completed" ||
      eventType === "call.transcript.completed"
    ) {
      const call = parseQuoCall(body);
      if (!isIncludedQuoNumber(call.ownNumber)) {
        return NextResponse.json({ received: true, skipped: "excluded phone number" });
      }
      // Distinct key per event type, alongside the original call.completed
      // event's `raw` - so if a field guess above is still wrong for
      // recording/summary specifically, the real payload is saved to fix
      // it from, the same way `raw` already covers the initial call.
      const rawKey =
        eventType === "call.recording.completed"
          ? "raw_recording_event"
          : eventType === "call.summary.completed"
            ? "raw_summary_event"
            : "raw_transcript_event";

      const patch: Record<string, unknown> = {
        recording_url: call.recordingUrl ?? undefined,
        summary: call.summary ?? undefined,
        transcript: call.transcript ?? undefined,
        [rawKey]: body,
      };

      let result = await patchActivityMetadata(admin, OWNER_ID, "quo", "quo_call_id", call.quoCallId, patch);

      // No call logged yet (call.completed hasn't arrived, or never will -
      // seen on a call Quo's AI agent answered): log the call from this
      // event, then attach. A later call.completed merges into the same row.
      if (!result && call.quoCallId && call.counterpartNumber) {
        const contact = await findOrCreateContact(admin, OWNER_ID, {
          phone: call.counterpartNumber,
          leadSource: "Quo (auto-created from call)",
        });
        if (contact) {
          await upsertActivity(admin, OWNER_ID, contact.id, "quo", "quo_call_id", call.quoCallId, {
            type: "call",
            direction: call.direction === "none" ? "inbound" : call.direction,
            occurred_at: call.occurredAt,
            body: describeCall(call),
            metadata: { quo_call_id: call.quoCallId, quo_event_type: eventType },
          });
          result = await patchActivityMetadata(admin, OWNER_ID, "quo", "quo_call_id", call.quoCallId, patch);
          if (result) await updateEngagementTag(admin, OWNER_ID, contact.id);
        }
      }

      // Silent no-op otherwise: either call.quoCallId didn't parse out of
      // this event at all (the recording/summary field-name guesses above
      // are still unconfirmed against a real payload), or no activity
      // exists yet for it. Either way the recording/transcript/summary is
      // lost with no trace - log the full raw event so a real payload is
      // sitting in Vercel's logs to fix the parsing from, next time this
      // happens.
      if (!result) {
        await reportFailure(
          `Quo ${eventType}: couldn't log it on a contact (quoCallId=${call.quoCallId ?? "null"}, other number=${call.counterpartNumber ?? "not found"})`,
          JSON.stringify(body),
        );
      }

      // A 12-second robocall has no summary/transcript at call.completed
      // time - re-check now that this event actually delivered text. Only
      // re-checks a contact not already flagged spam (no rule un-flags one
      // here; that's what "Not spam" in the bucket is for).
      if (result) {
        const contactId = result.contactId;
        const { data: contactRow } = await admin.from("contacts").select("spam").eq("id", contactId).maybeSingle();
        if (contactRow && !contactRow.spam) {
          const spamCheck = await checkCallForSpam(admin, OWNER_ID, call);
          if (spamCheck.isSpam) {
            result = await patchActivityMetadata(admin, OWNER_ID, "quo", "quo_call_id", call.quoCallId, {
              spam_reason: spamCheck.reason,
              spam_detected_at: new Date().toISOString(),
            });
            await admin.from("contacts").update({ spam: true }).eq("id", contactId);
          }
        }
      }

      // The wide extraction (Phase 3) only runs once a transcript actually
      // exists, and replaces the old single stage-nudge analysis for calls -
      // analyzeContactActivity below is still used, just for the
      // message.received branch's lighter text-message flow.
      if (eventType === "call.transcript.completed" && call.transcript && call.quoCallId && result) {
        const transcriptText = call.transcript;
        const quoCallId = call.quoCallId;
        const { data: contact } = await admin.from("contacts").select("known_personally, spam").eq("id", result.contactId).maybeSingle();

        const { id: transcriptId, wasCreated } = await createOrGetTranscript(admin, {
          ownerId: OWNER_ID,
          contactId: result.contactId,
          source: "quo",
          externalId: quoCallId,
          rawPayload: body,
          durationSeconds: call.durationSeconds,
          occurredAt: call.occurredAt,
        });

        // wasCreated guards against a redelivered webhook re-running
        // extraction a second time for the same call - the exact class of
        // bug this phase exists to stop repeating.
        if (wasCreated) {
          if (contact?.known_personally || contact?.spam) {
            // Per the design brief: the transcript is still stored (it's
            // already saved via patchActivityMetadata above and the
            // meeting_transcripts row just created), but no suggestions are
            // generated for a contact she knows personally.
            await admin.from("meeting_transcripts").update({ status: "no_proposals" }).eq("id", transcriptId);
          } else {
            after(() => runExtraction(admin, OWNER_ID, transcriptId, result.contactId, transcriptText));
          }
        }
      }
    } else if (eventType === "message.received" || eventType === "message.delivered") {
      const msg = parseQuoMessage(body);
      if (!isIncludedQuoNumber(msg.ownNumber)) {
        return NextResponse.json({ received: true, skipped: "excluded phone number" });
      }

      const contact = await findOrCreateContact(admin, OWNER_ID, {
        phone: msg.counterpartNumber,
        leadSource: "Quo (auto-created from text)",
      });
      if (!contact) {
        await reportFailure(
          msg.counterpartNumber
            ? `Quo text from ${msg.counterpartNumber} wasn't logged: couldn't match or create a contact`
            : "Quo text wasn't logged: no phone number found in Quo's webhook payload",
          { counterpart: msg.counterpartNumber, raw: JSON.stringify(body) },
        );
      }
      else console.log("Quo text logged on contact", contact.id, contact.wasCreated ? "(new contact)" : "");
      if (contact) {
        const activity = await upsertActivity(admin, OWNER_ID, contact.id, "quo", "quo_message_id", msg.quoMessageId, {
          type: "text",
          direction: msg.direction,
          occurred_at: msg.occurredAt,
          body: msg.text,
          metadata: { quo_message_id: msg.quoMessageId, quo_event_type: eventType, raw: body },
        });
        await updateEngagementTag(admin, OWNER_ID, contact.id);

        if (eventType === "message.received" && msg.direction === "inbound") {
          await warmColdProspectOnReply(admin, OWNER_ID, contact.id, "text", msg.text, msg.occurredAt);
        }

        if (eventType === "message.received" && msg.text) {
          if (isOptOutMessage(msg.text)) {
            // Fines here are per message - marked immediately, no AI
            // analysis on an opt-out (there's nothing to read into it),
            // and every future bulk send already filters on this.
            await recordOptOut(admin, contact.id);
          } else {
            await analyzeContactActivity(
              admin,
              OWNER_ID,
              contact.id,
              { type: "text", direction: msg.direction, content: msg.text },
              activity.id,
            );
          }
        }
      }
    } else {
      console.log("Unhandled Quo webhook event type:", eventType);
    }
  } catch (err) {
    await reportFailure("Error processing Quo webhook", eventType, err);
  }

  return NextResponse.json({ received: true });
}

// Shared by both spam-check points (call.completed, and the later
// transcript/summary re-check once text actually exists): an allowlisted
// number ("Not spam" was tapped for it before) never matches any rule
// again, and the repeat-missed-calls signal only makes sense for an
// inbound call that wasn't answered.
async function checkCallForSpam(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  call: ReturnType<typeof parseQuoCall>,
): Promise<SpamCheckResult> {
  if (await isNumberAllowlisted(admin, ownerId, call.counterpartNumber)) {
    return { isSpam: false, reason: null };
  }

  const [repeatedInboundNoVoicemail, disabledReasons] = await Promise.all([
    call.direction === "inbound" && !call.recordingUrl ? hasRecentMissedCallBurst(admin, ownerId) : Promise.resolve(false),
    getDisabledSpamReasons(admin, ownerId),
  ]);

  return detectSpam({
    summary: call.summary,
    transcript: call.transcript,
    durationSeconds: call.durationSeconds,
    status: call.status,
    hasVoicemail: !!call.recordingUrl,
    repeatedInboundNoVoicemail,
    disabledReasons,
  });
}

function describeCall(call: ReturnType<typeof parseQuoCall>) {
  const parts: string[] = [];
  if (call.durationSeconds != null) {
    const mins = Math.floor(call.durationSeconds / 60);
    const secs = call.durationSeconds % 60;
    parts.push(`${mins}m ${secs}s`);
  }
  if (call.status) parts.push(call.status);
  if (call.summary) parts.push(call.summary);
  return parts.join(" · ") || null;
}
