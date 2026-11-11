// Pure helpers for the text campaign builder: no server imports, so the
// editor (client) and the save action (server) validate the same way.

export type TriggerType = "source" | "tag" | "type" | "stage";

export type CampaignStepInput = {
  id: string;
  label: string;
  body: string;
  onReply: { next: string | null };
  onNoReply: { next: string | null; days?: number; time?: string };
};

export type CampaignInput = {
  id?: string;
  name: string;
  triggerType: TriggerType;
  triggerValue: string;
  // Tag campaigns: starts when any of these tags is added.
  triggerTagIds: string[];
  steps: CampaignStepInput[];
  // Don't start this campaign for anyone already in these campaigns.
  skipCampaignIds: string[];
  // Anyone with one of these tags is never texted by this campaign.
  skipTagIds: string[];
  // Anyone who texted back after one of these campaigns reached them.
  skipRepliedCampaignIds: string[];
};

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  source: "A new contact is added with Source",
  tag: "One of these tags is added to a contact (new or existing)",
  type: "A contact becomes Type",
  stage: "A contact moves to Stage",
};

// Returns the first problem, or null if the campaign can be saved.
export function validateCampaign(input: CampaignInput): string | null {
  if (!input.name.trim()) return "Give the campaign a name.";
  if (input.triggerType === "tag" ? input.triggerTagIds.length === 0 : !input.triggerValue.trim()) return "Choose what starts the campaign.";
  if (input.steps.length === 0) return "Add at least one text.";
  if (input.triggerType === "tag" && input.skipTagIds.some((t) => input.triggerTagIds.includes(t))) return "The campaign can't skip a tag that starts it.";
  const ids = new Set(input.steps.map((s) => s.id));
  const position = new Map(input.steps.map((s, i) => [s.id, i]));
  const label = (id: string) => input.steps[position.get(id)!]?.label ?? "that text";
  for (const [i, s] of input.steps.entries()) {
    if (!s.body.trim()) return `${s.label} has no message.`;
    if (s.body.length > 600) return `${s.label} is too long (keep texts under 600 characters).`;
    if (s.onReply.next && !ids.has(s.onReply.next)) return `${s.label}: the "if they reply" text no longer exists.`;
    if (s.onReply.next === s.id) return `${s.label} can't send itself as the reply.`;
    if (s.onNoReply.next) {
      if (!ids.has(s.onNoReply.next)) return `${s.label}: the "if no reply" text no longer exists.`;
      if (s.onNoReply.next === s.id) return `${s.label} can't follow itself.`;
      if (position.get(s.onNoReply.next)! < i)
        return `${s.label}: "if no reply" can't go back to ${label(s.onNoReply.next)} (it would repeat forever). Pick a later text or End.`;
      const days = s.onNoReply.days ?? 0;
      // 0 = right after this text (about a minute later), no time needed.
      if (!Number.isInteger(days) || days < 0 || days > 90) return `${s.label}: "days later" must be between 1 and 90.`;
      if (days > 0) {
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(s.onNoReply.time ?? "")) return `${s.label}: pick a time for the follow-up.`;
        const [h] = (s.onNoReply.time ?? "").split(":").map(Number);
        if (h < 9 || h >= 20) return `${s.label}: follow-ups must be between 9:00 AM and 8:00 PM ET.`;
      }
    }
  }
  return null;
}
