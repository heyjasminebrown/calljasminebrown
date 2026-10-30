// Normalizes any phone string down to a comparable key: the last 10 digits
// (US/Canada numbers, with or without a leading country code / punctuation).
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || phone === "") return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return !!na && !!nb && na === nb;
}

// E.164 for Quo's send API, which rejects anything with formatting
// punctuation (spaces, parens, dashes) - contacts are stored with whatever
// formatting they arrived with (e.g. "(202) 378-4546"), so this always
// needs to run right before a number goes out over the wire. US/Canada only,
// same assumption normalizePhone above already makes.
export function toE164(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `+1${normalized}` : null;
}
