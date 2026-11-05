// Best-effort parsing of Quo (formerly OpenPhone) webhook payloads. Field
// names follow their documented conventions but haven't been confirmed
// against a real delivery yet - see README's Quo section. The full raw
// body is always preserved on the activity's `metadata.raw` so nothing is
// lost even if a field guess here is wrong; we can backfill once confirmed.

import { normalizePhone } from "@/lib/phone";
import { OWNER_PHONE_E164 } from "@/lib/brand/identity";

type AnyRecord = Record<string, unknown>;

// Her own Quo line(s), to tell them apart from the other person when a
// payload lists every number together (data.context.participants.external).
function ownNumbers(): Set<string> {
  const raw = [process.env.QUO_SEND_PHONE_NUMBER, process.env.QUO_INCLUDED_PHONE_NUMBERS, OWNER_PHONE_E164].filter(Boolean).join(",");
  return new Set(raw.split(",").map((n) => normalizePhone(n)).filter((n): n is string => !!n));
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export type ParsedQuoCall = {
  quoCallId: string | null;
  direction: "inbound" | "outbound" | "none";
  counterpartNumber: string | null;
  ownNumber: string | null;
  durationSeconds: number | null;
  status: string | null;
  occurredAt: string;
  recordingUrl: string | null;
  summary: string | null;
  transcript: string | null;
};

export type ParsedQuoMessage = {
  quoMessageId: string | null;
  direction: "inbound" | "outbound" | "none";
  counterpartNumber: string | null;
  ownNumber: string | null;
  text: string | null;
  occurredAt: string;
};

// Older webhook payloads put the record at data.object; API version
// 2026-03-30 (seen on a real message.received delivery) moved it to
// data.resource, alongside data.context and data.links.
function unwrap(body: AnyRecord): AnyRecord {
  const data = body.data as AnyRecord | undefined;
  return (data?.resource as AnyRecord) ?? (data?.object as AnyRecord) ?? data ?? body;
}

// In 2026-03-30 payloads the resource has no from/to; the numbers sit in
// data.context instead (confirmed on a real message.received):
//   { senderIdentifier: "+1404...", recipientIdentifiers: ["+1404..."] }
//
// Call events (confirmed on real call.recording/transcript/summary
// deliveries, 2026-11-01) instead list both numbers together:
//   { participants: { external: ["+1404...(her line)", "+1404...(caller)"] } }
// so her own line is picked out by number and direction decides from/to.
function contextNumbers(body: AnyRecord, direction: "inbound" | "outbound" | "none"): { from: string | null; to: string | null } {
  const ctx = (body.data as AnyRecord | undefined)?.context as AnyRecord | undefined;
  const from = phoneOf(ctx?.senderIdentifier);
  const to = phoneOf(ctx?.recipientIdentifiers);
  if (from || to) return { from, to };

  const external = (ctx?.participants as AnyRecord | undefined)?.external;
  const numbers = (Array.isArray(external) ? external : [external]).map(phoneOf).filter((n): n is string => !!n);
  if (numbers.length === 0) return { from: null, to: null };
  const mine = ownNumbers();
  const own = numbers.find((n) => mine.has(normalizePhone(n) ?? "")) ?? null;
  const other = numbers.find((n) => !mine.has(normalizePhone(n) ?? "")) ?? null;
  return direction === "outbound" ? { from: own, to: other } : { from: other, to: own };
}

// A phone number given as a plain string, the first of a list, or an
// object wrapping it ({ phoneNumber } / { number } / { value }).
function phoneOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return phoneOf(v[0]);
  if (v && typeof v === "object") {
    const o = v as AnyRecord;
    return phoneOf(o.phoneNumber ?? o.number ?? o.value ?? o.e164);
  }
  return null;
}

function rawDirection(obj: AnyRecord): "inbound" | "outbound" | "none" {
  const d = asString(obj.direction);
  if (d === "incoming" || d === "inbound") return "inbound";
  if (d === "outgoing" || d === "outbound") return "outbound";
  return "none";
}

export function parseQuoCall(body: AnyRecord): ParsedQuoCall {
  const obj = unwrap(body);
  const direction = rawDirection(obj);
  const ctx = contextNumbers(body, direction);
  const from = phoneOf(obj.from) ?? phoneOf((obj.participants as AnyRecord | undefined)?.from) ?? phoneOf(obj.fromPhoneNumber) ?? ctx.from;
  const to = phoneOf(obj.to) ?? phoneOf((obj.participants as AnyRecord | undefined)?.to) ?? phoneOf(obj.toPhoneNumber) ?? ctx.to;
  const media = obj.media as AnyRecord[] | undefined;
  const recording = obj.recording as AnyRecord | undefined;
  // For a call that goes to voicemail, Quo delivers the recording +
  // transcript inline on call.completed itself as this nested object -
  // confirmed against Quo's own voicemail API shape - rather than only via
  // the separate call.recording.completed/call.transcript.completed events.
  // Missing this meant every voicemail-only call (the common case for a
  // missed/rejected call) came through with no recordingUrl and no
  // transcript at all, which in turn meant the spam keyword rules below had
  // no text to match against.
  const voicemail = obj.voicemail as AnyRecord | undefined;

  // call.transcript.completed's data.object IS the transcript itself, not
  // a call with a nested .transcript field - confirmed against a real
  // payload 2026-08-12: { object: "callTranscript", callId, dialogue: [...],
  // duration, status }. call.recording/summary.completed likely follow the
  // same callXxx/callId sub-resource pattern but haven't been confirmed the
  // same way yet - if a summary still doesn't show up, get a real payload
  // for that event type too and adjust the summary line below.
  const isTranscriptObject = obj.object === "callTranscript" || (Array.isArray(obj.dialogue) && !!obj.callId);
  const isSummaryObject = obj.object === "callSummary";
  const transcriptSource = isTranscriptObject ? obj : (obj.transcript as unknown);

  return {
    // The main call.completed event's call has its ID at `id`; the
    // transcript/summary/recording sub-resource events reference it via
    // `callId` instead - falling back covers both without needing to know
    // which event type this is.
    quoCallId: asString(obj.id) ?? asString(obj.callId),
    direction,
    counterpartNumber: direction === "outbound" ? to : from,
    ownNumber: direction === "outbound" ? from : to,
    // Transcript events send fractional seconds (e.g. 44.12081); stored as whole seconds.
    durationSeconds: typeof obj.duration === "number" && Number.isFinite(obj.duration) ? Math.round(obj.duration) : null,
    status: asString(obj.status),
    occurredAt: asString(obj.completedAt) ?? asString(obj.createdAt) ?? new Date().toISOString(),
    recordingUrl: asString(voicemail?.recordingUrl) ?? asString(media?.[0]?.url) ?? asString(recording?.url) ?? asString(obj.recordingUrl) ?? asString((obj.recordings as AnyRecord[] | undefined)?.[0]?.url),
    // call.summary.completed (2026-03-30) sends summary as a list of lines.
    summary: asString(obj.summary) ?? listText(obj.summary) ?? asString(obj.aiSummary) ?? (isSummaryObject ? asString(obj.content) ?? asString(obj.text) : null),
    transcript: asString(voicemail?.transcript) ?? parseTranscript(transcriptSource),
  };
}

function listText(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const lines = v.map((x) => asString(x) ?? asString((x as AnyRecord | null)?.text) ?? asString((x as AnyRecord | null)?.content)).filter(Boolean);
  return lines.length ? lines.join(" ") : null;
}

function parseTranscript(transcript: unknown): string | null {
  if (typeof transcript === "string") return transcript;
  if (transcript && typeof transcript === "object") {
    const obj = transcript as AnyRecord;
    if (typeof obj.text === "string") return obj.text;
    const dialogue = (obj.dialogue ?? obj.segments ?? obj.utterances) as AnyRecord[] | undefined;
    if (Array.isArray(dialogue)) {
      return dialogue
        .map((turn) => {
          const speaker = asString(turn.speaker) ?? asString(turn.identifier);
          const content = asString(turn.content) ?? asString(turn.text);
          return speaker && content ? `${speaker}: ${content}` : content;
        })
        .filter(Boolean)
        .join("\n");
    }
  }
  return null;
}

export function parseQuoMessage(body: AnyRecord): ParsedQuoMessage {
  const obj = unwrap(body);
  const direction = rawDirection(obj);
  const ctx = contextNumbers(body, direction);
  const from = phoneOf(obj.from) ?? ctx.from;
  const to = phoneOf(obj.to) ?? ctx.to;

  return {
    quoMessageId: asString(obj.id),
    direction,
    counterpartNumber: direction === "outbound" ? to : from,
    ownNumber: direction === "outbound" ? from : to,
    text: asString(obj.text) ?? asString(obj.body) ?? asString(obj.content),
    occurredAt: asString(obj.createdAt) ?? new Date().toISOString(),
  };
}
