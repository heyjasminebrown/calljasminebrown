// Best-effort parsing of Quo (formerly OpenPhone) webhook payloads. Field
// names follow their documented conventions but haven't been confirmed
// against a real delivery yet - see README's Quo section. The full raw
// body is always preserved on the activity's `metadata.raw` so nothing is
// lost even if a field guess here is wrong; we can backfill once confirmed.

type AnyRecord = Record<string, unknown>;

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function firstOf(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
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

function unwrap(body: AnyRecord): AnyRecord {
  const data = body.data as AnyRecord | undefined;
  return (data?.object as AnyRecord) ?? data ?? body;
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
  const from = asString(obj.from) ?? firstOf((obj.participants as AnyRecord | undefined)?.from);
  const to = asString(obj.to) ?? firstOf(obj.to) ?? firstOf((obj.participants as AnyRecord | undefined)?.to);
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
  const isTranscriptObject = obj.object === "callTranscript";
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
    durationSeconds: typeof obj.duration === "number" ? obj.duration : null,
    status: asString(obj.status),
    occurredAt: asString(obj.completedAt) ?? asString(obj.createdAt) ?? new Date().toISOString(),
    recordingUrl: asString(voicemail?.recordingUrl) ?? asString(media?.[0]?.url) ?? asString(recording?.url) ?? asString(obj.recordingUrl),
    summary: asString(obj.summary) ?? asString(obj.aiSummary) ?? (isSummaryObject ? asString(obj.content) ?? asString(obj.text) : null),
    transcript: asString(voicemail?.transcript) ?? parseTranscript(transcriptSource),
  };
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
  const from = asString(obj.from);
  const to = asString(obj.to) ?? firstOf(obj.to);

  return {
    quoMessageId: asString(obj.id),
    direction,
    counterpartNumber: direction === "outbound" ? to : from,
    ownNumber: direction === "outbound" ? from : to,
    text: asString(obj.text) ?? asString(obj.body),
    occurredAt: asString(obj.createdAt) ?? new Date().toISOString(),
  };
}
