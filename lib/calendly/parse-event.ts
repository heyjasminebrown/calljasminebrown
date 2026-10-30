// Best-effort parsing of Calendly webhook payloads - field names follow
// their documented conventions but haven't been confirmed against a real
// delivery yet. The full raw payload is always preserved in the activity's
// metadata.raw so nothing is lost even if a field guess here is wrong.

type AnyRecord = Record<string, unknown>;

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export type ParsedCalendlyInvitee = {
  inviteeUri: string | null;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  eventName: string | null;
  eventStartTime: string | null;
  questionsAndAnswers: { question: string; answer: string }[];
  createdAt: string;
};

export function parseCalendlyInvitee(body: AnyRecord): ParsedCalendlyInvitee {
  const payload = (body.payload as AnyRecord) ?? body;
  const scheduledEvent = payload.scheduled_event as AnyRecord | undefined;
  const qa = payload.questions_and_answers as AnyRecord[] | undefined;

  return {
    inviteeUri: asString(payload.uri),
    email: asString(payload.email),
    name: asString(payload.name),
    firstName: asString(payload.first_name),
    lastName: asString(payload.last_name),
    phone: asString(payload.text_reminder_number) ?? asString(payload.phone_number),
    eventName: asString(scheduledEvent?.name),
    eventStartTime: asString(scheduledEvent?.start_time),
    questionsAndAnswers: Array.isArray(qa)
      ? qa
          .map((item) => ({ question: asString(item.question) ?? "", answer: asString(item.answer) ?? "" }))
          .filter((item) => item.question)
      : [],
    createdAt: asString(payload.created_at) ?? new Date().toISOString(),
  };
}
