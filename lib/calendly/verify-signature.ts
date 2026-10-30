import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies a Calendly webhook signature. Best-effort implementation of
 * Calendly's documented scheme: the `Calendly-Webhook-Signature` header
 * carries `t=<timestamp>,v1=<hex hmac-sha256 signature>`, signing
 * `${t}.${rawBody}` with the webhook subscription's signing key. Like the
 * Quo integration, this hasn't been confirmed against a real delivery yet
 * - mismatches are logged (with full headers) but not rejected until
 * CRM_CALENDLY_ENFORCE_SIGNATURE is set, so the integration works while we
 * confirm the exact format from a live payload.
 */
export function verifyCalendlySignature(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  const enforce = process.env.CRM_CALENDLY_ENFORCE_SIGNATURE === "true";

  if (!signingKey) {
    return { ok: !enforce, reason: "CALENDLY_WEBHOOK_SIGNING_KEY not configured" };
  }

  const header = headers.get("calendly-webhook-signature");
  if (!header) {
    return { ok: !enforce, reason: "no Calendly-Webhook-Signature header present" };
  }

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const timestamp = parts.t;
  const providedSignature = parts.v1;
  if (!timestamp || !providedSignature) {
    return { ok: !enforce, reason: `unrecognized signature header shape: ${header}` };
  }

  try {
    const expected = createHmac("sha256", signingKey).update(`${timestamp}.${rawBody}`).digest("hex");
    const match =
      expected.length === providedSignature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
    return { ok: match || !enforce, reason: match ? undefined : "signature mismatch" };
  } catch (err) {
    return { ok: !enforce, reason: `verification error: ${(err as Error).message}` };
  }
}
