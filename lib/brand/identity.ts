// ============================================================================
// BUSINESS IDENTITY — EDIT THIS FILE for your business.
//
// This is the one place the chassis hardcodes who "you" are: the name shown
// in the nav/app chrome, the sender name on outbound emails, the copy in
// public booking pages, and the PWA manifest/app title. Nothing else in the
// codebase should hardcode a person's name, brokerage/company name, phone
// number, or domain — if you find something that does, it belongs here
// instead (and please fix the reference to import from here).
//
// None of these values are secrets. Real credentials (API keys, OAuth
// secrets, service-role keys) live in environment variables — see
// .env.example — never in this file.
// ============================================================================

/** The person (or team) this CRM instance belongs to. Shown in app chrome,
 * the Today greeting, booking-page copy, and as the default sender name on
 * outbound emails. */
export const OWNER_NAME = "Jasmine Brown";

/** First name only, used for short greetings ("Good morning, {OWNER_FIRST_NAME}"). */
export const OWNER_FIRST_NAME = OWNER_NAME.split(" ")[0] ?? OWNER_NAME;

/** Company / brokerage / lending shop name, shown alongside OWNER_NAME in
 * a few places (email signatures, etc). Leave "" to omit it entirely. */
// TODO: set Jasmine's lending company name (left blank so outbound email
// isn't signed "with Your Company" in the meantime).
export const COMPANY_NAME = "";

/** Short product name for the app shell: browser tab title, PWA manifest
 * name/short_name, nav wordmark, "Add [APP_NAME] to your Home Screen"-style
 * copy. Keep it short — it appears in the mobile home-screen icon label. */
export const APP_NAME = "Jasmine CRM";
export const APP_SHORT_NAME = APP_NAME;

/** Fallback phone number shown on public pages (e.g. booking confirmations)
 * when no better contact channel is available. Must be a real number you
 * own before going live — this placeholder will not receive calls/texts.
 * Format: E.164 for tel: links, human-readable for display. */
export const OWNER_PHONE_E164 = process.env.NEXT_PUBLIC_OWNER_PHONE_E164 ?? "+10000000000";
export const OWNER_PHONE_DISPLAY = process.env.NEXT_PUBLIC_OWNER_PHONE_DISPLAY ?? "000-000-0000";

/** Default sender display name on outbound Gmail sends (lib/google/send-email.ts). */
export const EMAIL_SENDER_NAME = COMPANY_NAME ? `${OWNER_NAME} with ${COMPANY_NAME}` : OWNER_NAME;

/** Path to this CRM instance's own headshot/avatar, served from public/.
 * Swap the actual image file at that path in public/. */
export const OWNER_HEADSHOT_SRC = "/images/owner-headshot.jpg";

/** The CRM's own deployed origin (NOT a separate marketing site). Used to
 * build absolute URLs for tracking pixels, click redirects, unsubscribe
 * links, and anywhere an email/SMS needs a link back into the app. Set
 * APP_BASE_URL in your environment; this is just the fallback for local
 * dev when that env var isn't set. */
export const DEFAULT_APP_ORIGIN = "http://localhost:3000";

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? DEFAULT_APP_ORIGIN).replace(/\/$/, "");
}
