import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Quo (formerly OpenPhone) webhook signature.
 *
 * Best-effort implementation of Quo's documented scheme: the
 * `openphone-signature` header carries `hmac;1;<timestamp>;<signature>`,
 * where `<signature>` is HMAC-SHA256 (base64) of `${timestamp}.${rawBody}`
 * using the base64-decoded signing key from the webhook's creation
 * response. This has NOT yet been confirmed against a real delivery from
 * this account - see README's Quo section. Until CRM_QUO_ENFORCE_SIGNATURE
 * is set, mismatches are logged but not rejected, so the integration keeps
 * working while we confirm the exact header/format from a live payload.
 */
export function verifyQuoSignature(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const signingKey = process.env.QUO_WEBHOOK_SIGNING_KEY;
  const enforce = process.env.CRM_QUO_ENFORCE_SIGNATURE === "true";

  if (!signingKey) {
    return { ok: !enforce, reason: "QUO_WEBHOOK_SIGNING_KEY not configured" };
  }

  const header = headers.get("openphone-signature") ?? headers.get("quo-signature");
  if (!header) {
    return { ok: !enforce, reason: "no signature header present" };
  }

  const parts = header.split(";");
  const timestamp = parts[2];
  const providedSignature = parts[3];
  if (!timestamp || !providedSignature) {
    return { ok: !enforce, reason: `unrecognized signature header shape: ${header}` };
  }

  try {
    const keyBuffer = Buffer.from(signingKey, "base64");
    const expected = createHmac("sha256", keyBuffer).update(`${timestamp}.${rawBody}`).digest("base64");
    const match =
      expected.length === providedSignature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
    return { ok: match || !enforce, reason: match ? undefined : "signature mismatch" };
  } catch (err) {
    return { ok: !enforce, reason: `verification error: ${(err as Error).message}` };
  }
}
