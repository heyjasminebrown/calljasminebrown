import { normalizePhone } from "@/lib/phone";

// Optional allowlist - she runs a second Quo number for rooms-for-rent
// texting that has nothing to do with the CRM, and doesn't want any of
// its calls/texts pulled in. Unset (the default before this existed)
// means every number on the account is processed, same as before.
export function isIncludedQuoNumber(ownNumber: string | null): boolean {
  const raw = process.env.QUO_INCLUDED_PHONE_NUMBERS;
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((n) => normalizePhone(n))
    .filter((n): n is string => !!n);
  if (allowed.length === 0) return true;

  const own = normalizePhone(ownNumber);
  // No number on the event at all (a parsing gap) - fail open rather than
  // silently dropping a real call/text because a field guess came back
  // empty, matching this webhook's existing "log it, don't lose it" posture.
  if (!own) return true;

  return allowed.includes(own);
}
