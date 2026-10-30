import { createHmac, timingSafeEqual } from "crypto";

// Meta's messaging webhooks (Instagram included) sign the raw POST body
// with the app secret: X-Hub-Signature-256: sha256=<hex hmac>. This is a
// well-documented, stable part of the Messenger-platform-style webhook
// contract Meta uses across Messenger/Instagram/WhatsApp, but hasn't been
// confirmed against a real delivery from this account - if it ever
// rejects a real webhook, log the raw header and adjust, same as every
// other integration's verify-signature module in this codebase.
export function verifyInstagramSignature(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return { ok: false, reason: "META_APP_SECRET not configured" };

  const header = headers.get("x-hub-signature-256");
  if (!header) return { ok: false, reason: "no x-hub-signature-256 header present" };

  const [scheme, providedSignature] = header.split("=");
  if (scheme !== "sha256" || !providedSignature) return { ok: false, reason: `unrecognized signature header shape: ${header}` };

  try {
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const match = expected.length === providedSignature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
    return { ok: match, reason: match ? undefined : "signature mismatch" };
  } catch (err) {
    return { ok: false, reason: `verification error: ${(err as Error).message}` };
  }
}
