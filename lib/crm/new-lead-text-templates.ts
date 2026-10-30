// Pure string logic, no imports - same style as text-blast-templates.ts.
//
// First-touch SMS for New/uncontacted, source-routed templates with
// {{first_name}} merged at compose. EDIT THE COPY BELOW for your own
// business - these are generic starting points, not locked copy. The
// sender identity comes from lib/brand/identity.ts (edit that file, not
// this one, to change who these messages say they're from).
//
// The original app routed several of these by which Eventbrite meetup a
// lead registered through (Women's REI / House Hacking) and by its own
// listing/offering-memorandum pages - both intentionally excluded from
// this chassis (see README), so those source buckets are gone too.

import { OWNER_NAME, COMPANY_NAME } from "@/lib/brand/identity";

export type NewLeadSourceBucket = "site_form" | "instagram" | "referral" | "blinq" | "scheduling" | "quo" | "zillow" | "facebook" | "other";

export type NewLeadSourceInfo = { bucket: NewLeadSourceBucket; label: string };

export type FirstTouchSource = "blinq" | "webform" | "zillow" | "facebook" | "other";

export type FirstTouchSignals = {
  leadSource?: string | null;
  lastEventName?: string | null;
  tagNames?: readonly string[] | null;
  eventbriteAccount?: string | null;
};

const SIGNATURE = COMPANY_NAME ? `${OWNER_NAME} with ${COMPANY_NAME}` : OWNER_NAME;

export const FIRST_TOUCH_BLINQ = `Hi {{first_name}}, this is ${OWNER_NAME}! It was great meeting you! 🙂`;

export const FIRST_TOUCH_WEBFORM = `Hi {{first_name}}, this is ${SIGNATURE}. Thanks for reaching out through my site — just wanted to introduce myself and see what you're looking for! Any questions I can answer for you? 🙂`;

export const FIRST_TOUCH_ZILLOW = `Hey {{first_name}} — ${OWNER_NAME} here${COMPANY_NAME ? ` (${COMPANY_NAME})` : ""}. Saw you came through Zillow — want me to pull some options that match what you liked?`;

export const FIRST_TOUCH_FACEBOOK = `Hey {{first_name}} — ${OWNER_NAME} here${COMPANY_NAME ? ` (${COMPANY_NAME})` : ""}. Saw you came through Facebook — wanted to introduce myself and see how I can help!`;

// Last resort only when none of the sources match.
export const FIRST_TOUCH_FALLBACK = `Hi {{first_name}}, this is ${OWNER_NAME}…`;

export const FIRST_TOUCH_SOURCE_LABEL: Record<FirstTouchSource, string> = {
  blinq: "Blinq",
  webform: "Website",
  zillow: "Zillow",
  facebook: "Facebook",
  other: "New lead",
};

const BLINQ_TEXT = /\bblinq\b/i;
const ZILLOW_TEXT = /\bzillow\b/i;
const FACEBOOK_TEXT = /\bfacebook\b|\bfb lead/i;
// Generic "came through my own website's contact/lead form" signal - edit
// this to match whatever your own site's lead_source string actually is.
const WEBFORM_TEXT = /\bwebsite\b|\bweb\s*form\b|\bcontact form\b/i;

function blob(signals: FirstTouchSignals): string {
  return [signals.leadSource, signals.lastEventName].filter(Boolean).join("\n");
}

function tagSet(signals: FirstTouchSignals): Set<string> {
  return new Set((signals.tagNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean));
}

export function resolveFirstTouchSource(signals: FirstTouchSignals): FirstTouchSource {
  const tags = tagSet(signals);
  const text = blob(signals);
  const lead = signals.leadSource?.trim() ?? "";

  if (ZILLOW_TEXT.test(lead) || tags.has("zillow")) return "zillow";
  if (FACEBOOK_TEXT.test(lead) || tags.has("facebook")) return "facebook";
  if (tags.has("blinq") || BLINQ_TEXT.test(lead) || BLINQ_TEXT.test(text)) return "blinq";
  if (WEBFORM_TEXT.test(lead)) return "webform";
  if (ZILLOW_TEXT.test(text)) return "zillow";
  if (FACEBOOK_TEXT.test(text)) return "facebook";

  return "other";
}

export function eventbriteAccountFromActivities(_activities: { metadata?: Record<string, unknown> | null }[]): string | null {
  // The original app used this to pick which meetup's name/voice a
  // first-touch text used (Eventbrite registrations tagged "womens_rei"
  // or "house_hacking"). That whole meetup-events feature is excluded
  // from this chassis (see README) - kept as a no-op so callers that
  // still pass this signal through don't need to change.
  return null;
}

export function messageComposeHref(contactId: string, draft?: string | null): string {
  const trimmed = draft?.trim();
  if (!trimmed) return `/messages/${contactId}`;
  return `/messages/${contactId}?draft=${encodeURIComponent(trimmed)}`;
}

export function firstTouchTemplate(signals: FirstTouchSignals): string {
  switch (resolveFirstTouchSource(signals)) {
    case "blinq":
      return FIRST_TOUCH_BLINQ;
    case "webform":
      return FIRST_TOUCH_WEBFORM;
    case "zillow":
      return FIRST_TOUCH_ZILLOW;
    case "facebook":
      return FIRST_TOUCH_FACEBOOK;
    default:
      return FIRST_TOUCH_FALLBACK;
  }
}

export function firstTouchSourceChipLabel(signals: FirstTouchSignals): string {
  const source = resolveFirstTouchSource(signals);
  if (source !== "other") return FIRST_TOUCH_SOURCE_LABEL[source];
  const lead = signals.leadSource?.trim();
  if (lead) return lead;
  return FIRST_TOUCH_SOURCE_LABEL.other;
}

// First SMS compose (no outbound text yet) always gets a draft — matched
// source template, or the last-resort intro. Do not leave compose blank.
export function shouldPrefillFirstTouchSms(opts: { hasOutboundText: boolean; hasPriorOutreach?: boolean; source: FirstTouchSource }): boolean {
  return !opts.hasOutboundText;
}

const PATTERNS: { test: RegExp; bucket: NewLeadSourceBucket; label: string }[] = [
  { test: /instagram/i, bucket: "instagram", label: "Instagram" },
  { test: /referral/i, bucket: "referral", label: "Referral" },
  { test: /blinq/i, bucket: "blinq", label: "Blinq" },
  { test: /scheduling page|calendly/i, bucket: "scheduling", label: "Scheduling" },
  { test: /^quo /i, bucket: "quo", label: "Inbound call/text" },
  { test: /zillow/i, bucket: "zillow", label: "Zillow" },
  { test: /facebook/i, bucket: "facebook", label: "Facebook" },
  { test: WEBFORM_TEXT, bucket: "site_form", label: "Website" },
];

export function resolveNewLeadSource(leadSource: string | null): NewLeadSourceInfo {
  if (!leadSource) return { bucket: "other", label: "New lead" };
  const hit = PATTERNS.find((p) => p.test.test(leadSource));
  if (hit) return { bucket: hit.bucket, label: hit.label };
  return { bucket: "other", label: leadSource };
}

export function buildNewLeadDraft(firstName: string, leadSource: string | null, extra?: Omit<FirstTouchSignals, "leadSource">): string {
  const template = firstTouchTemplate({ leadSource, ...extra });
  return template.replace(/\{\{\s*first_name\s*\}\}/gi, firstName || "");
}
