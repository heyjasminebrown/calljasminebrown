// Shared low-level client for Quo's API (api.openphone.com/v1 - Quo is
// OpenPhone's current name, the API host hasn't changed). Used by both
// outbound texting and contact sync.

export async function quoFetch(path: string, init: RequestInit) {
  const apiKey = process.env.QUO_API_KEY;
  if (!apiKey) throw new Error("QUO_API_KEY is not configured");

  return fetch(`https://api.openphone.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

let cachedPhoneNumberId: string | null = null;

// Which number outbound texts/notifications send from. Used to just take
// the first number the API listed - fine with one number on the account,
// but silently wrong the moment a second one exists (confirmed live: once
// a rooms-for-rent number was added, /phone-numbers apparently started
// returning it first, and every CRM-triggered text went out from that
// number instead of her real business line - see phone-filter.ts's
// QUO_INCLUDED_PHONE_NUMBERS for the same "second number" problem on the
// inbound side). Now pinned explicitly by QUO_SEND_PHONE_NUMBER (any
// format - matched digit-for-digit via phonesMatch) instead of guessed by
// list order, and fails loudly rather than silently picking a number if
// that pin is missing and the account has more than one number on it.
export async function getQuoPhoneNumberId(): Promise<string> {
  if (cachedPhoneNumberId) return cachedPhoneNumberId;

  const res = await quoFetch("/phone-numbers", { method: "GET" });
  if (!res.ok) {
    throw new Error(`Could not look up Quo phone number (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  const numbers = (body?.data ?? []) as Array<Record<string, unknown>>;
  if (numbers.length === 0) throw new Error("No phone number found on this Quo account");

  const pinned = process.env.QUO_SEND_PHONE_NUMBER;
  if (pinned) {
    const { phonesMatch } = await import("@/lib/phone");
    const match = numbers.find((n) =>
      [n.phoneNumber, n.number, n.formattedNumber].some((candidate) => typeof candidate === "string" && phonesMatch(candidate, pinned)),
    );
    if (!match?.id) throw new Error(`QUO_SEND_PHONE_NUMBER (${pinned}) doesn't match any number on this Quo account`);
    cachedPhoneNumberId = match.id as string;
    return cachedPhoneNumberId;
  }

  if (numbers.length > 1) {
    throw new Error(
      "This Quo account has more than one phone number - set QUO_SEND_PHONE_NUMBER to the one outbound texts should send from, or every send risks going out from the wrong number.",
    );
  }

  const id = numbers[0]?.id as string | undefined;
  if (!id) throw new Error("No phone number found on this Quo account");
  cachedPhoneNumberId = id;
  return id;
}
