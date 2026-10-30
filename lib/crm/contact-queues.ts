// Pure constants/types only - no server imports - so client components
// (the Filters bar's quick-queue chips) can import this directly without
// pulling in Supabase/next-headers server code. The actual matching logic
// lives in contact-queue-filter.ts, imported only from server code.

// One-tap working lists for the Contacts page - each answers a specific
// "who should I be reaching out to right now" question instead of making
// her assemble the right combination of filters by hand every time.
export type ContactQueue =
  | "no_followup_after_registration"
  | "no_show"
  | "attended_gone_quiet"
  | "cold_from_hot"
  | "never_called"
  | "no_contact"
  | "repeat_attendees"
  | "ai_flagged"
  | "duplicate_risk"
  | "no_phone";

export const QUEUES: { value: ContactQueue; label: string; description: string }[] = [
  { value: "no_followup_after_registration", label: "Registered, no follow-up", description: "Signed up for an event, no call/text/email since" },
  { value: "no_show", label: "No-shows to re-invite", description: "Registered for an event but never checked in" },
  { value: "attended_gone_quiet", label: "Attended, gone quiet", description: "Checked in at an event, nothing logged since" },
  { value: "cold_from_hot", label: "Went cold from Hot/Ready", description: "High likelihood to close, no activity in 30+ days" },
  { value: "never_called", label: "Never called", description: "No call logged, ever" },
  { value: "no_contact", label: "No contact yet", description: "No call, text, or email logged, ever" },
  { value: "repeat_attendees", label: "Repeat attendees", description: "Checked in at 2+ events - your regulars" },
  { value: "ai_flagged", label: "AI flagged, not actioned", description: "Has a pending AI insight you haven't applied or dismissed" },
  { value: "duplicate_risk", label: "Possible duplicates", description: "Matches another contact by email or phone" },
  { value: "no_phone", label: "No phone number", description: "Email only - can't be called or texted" },
];
