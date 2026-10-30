// Sends a text through Quo's API. Best-effort against their documented
// REST conventions - not yet confirmed against a real send, since only
// inbound webhooks have been tested so far. If this errors, the response
// body is included so we can adjust the request shape from a real error
// message instead of guessing further.

import { quoFetch, getQuoPhoneNumberId } from "@/lib/quo/client";
import { toE164 } from "@/lib/phone";

export async function sendQuoText(
  toNumber: string,
  content: string,
): Promise<{ ok: true; quoMessageId: string | null } | { ok: false; error: string }> {
  try {
    const to = toE164(toNumber);
    if (!to) return { ok: false, error: `Invalid phone number: ${toNumber}` };

    const phoneNumberId = await getQuoPhoneNumberId();

    const res = await quoFetch("/messages", {
      method: "POST",
      body: JSON.stringify({ content, from: phoneNumberId, to: [to] }),
    });

    if (!res.ok) {
      return { ok: false, error: `Quo API error (${res.status}): ${await res.text()}` };
    }

    const body = await res.json();
    return { ok: true, quoMessageId: body?.data?.id ?? null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
