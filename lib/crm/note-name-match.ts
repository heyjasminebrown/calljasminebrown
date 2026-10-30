import type { SupabaseClient } from "@supabase/supabase-js";

export type NameCandidate = { id: string; first_name: string; last_name: string };

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

// A calendar invite or an attendee email is the reliable match; this is
// the fallback for a note with neither - an in-person coffee or a phone
// memo where the only trace of who it was with is her saying their name.
// Deliberately a plain substring check, not an AI call: cheap, explainable
// ("found her name in the note"), and good enough for a first/last name
// that's genuinely distinctive - a false positive on a common first name
// alone is exactly why this requires the full "first last" pair.
export function findNameCandidates(contacts: NameCandidate[], transcriptText: string): NameCandidate[] {
  const haystack = normalize(transcriptText);
  return contacts.filter((c) => {
    const full = normalize(`${c.first_name} ${c.last_name}`.trim());
    return full.length >= 3 && haystack.includes(full);
  });
}

// Checked before the live substring search - once she's confirmed "That's
// her" for a name once, the same name resolves automatically next time
// instead of asking again.
export async function matchByRememberedName(admin: SupabaseClient, ownerId: string, transcriptText: string): Promise<string | null> {
  const { data } = await admin.from("note_name_matches").select("name_text, contact_id").eq("owner_id", ownerId);
  const haystack = normalize(transcriptText);
  const match = (data ?? []).find((row) => haystack.includes(row.name_text));
  return match?.contact_id ?? null;
}

export async function rememberNameMatch(admin: SupabaseClient, ownerId: string, nameText: string, contactId: string): Promise<void> {
  await admin
    .from("note_name_matches")
    .upsert({ owner_id: ownerId, name_text: normalize(nameText), contact_id: contactId }, { onConflict: "owner_id,name_text" });
}

export type GranolaMatchingRules = {
  match_on_calendar_event: boolean;
  match_on_name_when_single: boolean;
  ask_when_ambiguous: boolean;
};

const DEFAULT_RULES: GranolaMatchingRules = { match_on_calendar_event: true, match_on_name_when_single: true, ask_when_ambiguous: true };

export async function getGranolaMatchingRules(admin: SupabaseClient, ownerId: string): Promise<GranolaMatchingRules> {
  const { data } = await admin
    .from("granola_matching_settings")
    .select("match_on_calendar_event, match_on_name_when_single, ask_when_ambiguous")
    .eq("owner_id", ownerId)
    .maybeSingle();
  return data ?? DEFAULT_RULES;
}
