import type { SupabaseClient } from "@supabase/supabase-js";

// Opt-out is still tracked (an explicit STOP is a hard no, worth
// honoring regardless of how someone got into the CRM), but consent
// isn't recorded up front any more - she gave a lower bar ("they gave
// you their number") than requiring a logged reason per contact.
export async function recordOptOut(admin: SupabaseClient, contactId: string): Promise<void> {
  await admin.from("contacts").update({ opted_out_at: new Date().toISOString() }).eq("id", contactId);
}

// CTIA-standard opt-out keywords, matched as the ENTIRE message body
// (trimmed, case-insensitive) - not a substring check, so "she stopped by
// today" in a note or a real text never gets mistaken for an opt-out.
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

export function isOptOutMessage(text: string): boolean {
  return STOP_KEYWORDS.has(text.trim().toLowerCase());
}
