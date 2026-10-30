// Instagram Messaging (via the Graph API) delivers webhooks in the same
// entry/messaging[] shape Meta uses across its messaging products
// (Messenger, WhatsApp) - not confirmed against a real delivery from this
// account, so every field is read defensively and the route logs the raw
// body whenever a required field is missing, same "fix it from a real
// payload" approach used throughout this codebase's other integrations.
export type InstagramMessageEvent = {
  senderId: string;
  messageId: string;
  text: string;
  occurredAt: string;
  isEcho: boolean;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseInstagramEvents(body: Record<string, unknown>): InstagramMessageEvent[] {
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const events: InstagramMessageEvent[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const messaging = Array.isArray((entry as Record<string, unknown>).messaging) ? (entry as Record<string, unknown>).messaging : [];
    for (const event of messaging as unknown[]) {
      if (!event || typeof event !== "object") continue;
      const e = event as Record<string, unknown>;
      const sender = e.sender as Record<string, unknown> | undefined;
      const message = e.message as Record<string, unknown> | undefined;

      const senderId = asString(sender?.id);
      const text = asString(message?.text);
      const messageId = asString(message?.mid);
      if (!senderId || !text || !messageId) continue;

      const timestamp = typeof e.timestamp === "number" ? e.timestamp : Number(e.timestamp);
      const occurredAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();

      events.push({ senderId, messageId, text, occurredAt, isEcho: message?.is_echo === true });
    }
  }

  return events;
}
