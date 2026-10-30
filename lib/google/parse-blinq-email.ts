// Blinq sends this notification (free tier included, no Zapier/Business
// needed) every time someone shares their card back with her. Confirmed
// against a real one (body, HTML stripped):
//
//   Hi {Owner},
//   Jane Example recently received your Blinq card and has sent you their details:
//   View in Blinq
//   Jane Example
//   +1 555-555-0123
//   jane.example@example.com
//   You can send a message to them by replying to this email...
//
// The name is pulled from right after "View in Blinq" - the exact
// wording there and in the intro sentence is far more reliable than the
// subject line turned out to be (the first version of this parser
// required an exact subject match and silently discarded a perfectly
// parseable body whenever the real subject didn't match it character for
// character - this version only needs the subject for a loose "is this
// worth fetching the full email for" pre-filter, and falls back to it
// for the name only if the body's own structure doesn't turn one up).
const SUBJECT_HINT = /sent you their details/i;
const NAME_FROM_SUBJECT = /^(?:\p{Emoji_Presentation}\s*)?(.+?)\s+has sent you their details/iu;
const VIEW_IN_BLINQ = /view\s+in\s+blinq/i;

// Separator class covers a plain space/period/hyphen plus the unicode
// dash variants a styled email template sometimes substitutes (hyphen
// through horizontal bar, U+2010-U+2015).
const SEP = "[\\s.\\u2010-\\u2015-]?";
const PHONE_PATTERN = new RegExp(`\\+?1?${SEP}\\(?\\d{3}\\)?${SEP}\\d{3}${SEP}\\d{4}`);
const EMAIL_PATTERN = /[^\s<>,"]+@[^\s<>,"]+\.[^\s<>,"]+/g;
// A name-shaped candidate: a couple of capitalized-ish words, nothing
// longer - guards against grabbing a stray sentence fragment if a future
// Blinq template doesn't match this layout.
const NAME_SHAPE = /^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,4}$/;

export function looksLikeBlinqShareEmail(subject: string): boolean {
  return SUBJECT_HINT.test(subject);
}

export type ParsedBlinqShare = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export function parseBlinqShareEmail(subject: string, bodyText: string): ParsedBlinqShare | null {
  const phoneMatch = bodyText.match(PHONE_PATTERN);
  const phone = phoneMatch?.[0]?.trim() ?? null;

  const emailMatches = bodyText.match(EMAIL_PATTERN) ?? [];
  // Blinq's own addresses (e.g. a connect+...@blinq.me reply-to, or their
  // support@blinq.me line) can show up in the body too - skip those so
  // the shared contact's real email never gets mistaken for Blinq's own.
  const email = emailMatches.find((e) => !e.toLowerCase().includes("@blinq")) ?? null;

  if (!phone && !email) return null;

  const name =
    extractNameNearContactInfo(bodyText, phoneMatch?.[0], email ?? undefined) ?? subject.match(NAME_FROM_SUBJECT)?.[1]?.trim() ?? null;
  const [firstName, ...rest] = (name ?? "").split(/\s+/).filter(Boolean);

  return { firstName: firstName || null, lastName: rest.join(" ") || null, phone, email };
}

// Anchors on whichever of phone/email appears first in the body - a share
// with only an email (no phone) used to fall straight through to the
// subject-line fallback below, since the old version anchored on the phone
// alone and bailed out with no phone match at all.
function extractNameNearContactInfo(bodyText: string, phoneText: string | undefined, emailText: string | undefined): string | null {
  const phoneIdx = phoneText ? bodyText.indexOf(phoneText) : -1;
  const emailIdx = emailText ? bodyText.indexOf(emailText) : -1;
  const candidateIdxs = [phoneIdx, emailIdx].filter((i) => i >= 0);
  if (candidateIdxs.length === 0) return null;
  const anchorIdx = Math.min(...candidateIdxs);

  const viewInBlinqMatch = bodyText.match(VIEW_IN_BLINQ);
  const start =
    viewInBlinqMatch && bodyText.indexOf(viewInBlinqMatch[0]) < anchorIdx
      ? bodyText.indexOf(viewInBlinqMatch[0]) + viewInBlinqMatch[0].length
      : Math.max(0, anchorIdx - 60);

  const candidate = bodyText.slice(start, anchorIdx).replace(VIEW_IN_BLINQ, "").trim();
  return candidate && candidate.length <= 60 && NAME_SHAPE.test(candidate) ? candidate : null;
}
