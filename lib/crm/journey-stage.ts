import type { SupabaseClient } from "@supabase/supabase-js";
import { addTagByName } from "./find-or-create-contact";

// Shared by Eventbrite and Jotform: both ask the same "where are you at in
// your house hacking journey?" question. Matching is keyword-based rather
// than exact-string, since the two platforms may render the wording
// (dashes, punctuation) slightly differently even with the same options
// configured.
type Classification = "researching" | "first_time" | "repeat_active" | "repeat_passive";

function classify(rawAnswer: string): Classification | null {
  const a = rawAnswer.toLowerCase();
  if (a.includes("research")) return "researching";
  if (a.includes("next one") || (a.includes("already") && a.includes("looking"))) return "repeat_active";
  if (a.includes("not actively looking") || a.includes("currently house hacking")) return "repeat_passive";
  if (a.includes("first house hack") || a.includes("looking for")) return "first_time";
  return null;
}

const STAGE_BY_CLASSIFICATION: Record<Classification, string | null> = {
  researching: "New Lead",
  first_time: "Hot / Ready",
  repeat_active: "Hot / Ready",
  repeat_passive: null,
};

const TAGS_BY_CLASSIFICATION: Record<Classification, string[]> = {
  researching: [],
  first_time: ["First-Time Buyer"],
  repeat_active: ["House Hacker"],
  repeat_passive: ["House Hacker"],
};

// Only fires when the journey-stage question was actually asked/answered -
// this doubles as the signal that the event/form was house-hacking-focused
// in the first place (women's meetups and other non-house-hacking events
// won't include this question, so they correctly get skipped here and only
// the generic "Meetup" tag applies, handled by the caller).
//
// Only sets the stage on brand-new contacts - an existing contact's stage
// reflects real relationship progress and shouldn't be overwritten by a
// meetup form answer. Tags apply either way.
export async function applyJourneyStageAnswer(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  rawAnswer: string | null,
  isNewContact: boolean,
) {
  if (!rawAnswer) return;

  await addTagByName(admin, ownerId, contactId, "House Hacking");

  const classification = classify(rawAnswer);
  if (!classification) return;

  for (const tagName of TAGS_BY_CLASSIFICATION[classification]) {
    await addTagByName(admin, ownerId, contactId, tagName);
  }

  const stageName = STAGE_BY_CLASSIFICATION[classification];
  if (isNewContact && stageName) {
    const { data: stage } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("name", stageName)
      .maybeSingle();
    if (stage) {
      await admin.from("contacts").update({ stage_id: stage.id }).eq("id", contactId);
    }
  }
}
