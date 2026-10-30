import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const MODEL = "claude-haiku-4-5-20251001";

const INSIGHT_TOOL = {
  name: "record_insight",
  description: "Records an analysis of a new activity (call, text, or email) against a real estate contact's CRM record.",
  input_schema: {
    type: "object" as const,
    properties: {
      has_signal: {
        type: "boolean",
        description:
          "True only if this activity reveals something worth surfacing that isn't already obvious from just reading the message - a new timeline/budget/concern, a stage-worthy update, a concrete next step. False for a plain conversational close or acknowledgment with no new information: \"ok that works\", \"have a good night!\", \"thanks!\", \"sounds good\", \"perfect\", \"see you then\", a one-word confirmation. She already read the message itself; don't restate it back to her as an 'insight'.",
      },
      needs_reply: {
        type: "boolean",
        description:
          "Only meaningful for an inbound text. True if this message is waiting on a reply from her - it asks a question, makes a request, or leaves something open. False if it closes the exchange and needs nothing further - a goodbye, a thank-you, a simple acknowledgment/confirmation like \"ok that works\" or \"sounds good\". For a call or email, or an outbound message, set this to false.",
      },
      summary: {
        type: "string",
        description: "1-2 sentence plain-English summary of what this activity reveals about the contact's status. Only read when has_signal is true.",
      },
      suggested_stage: {
        type: ["string", "null"],
        description:
          "The pipeline stage name this contact should probably move to, exactly matching one of the provided stage names - or null if no change is warranted.",
      },
      suggested_timeline: {
        type: ["string", "null"],
        enum: ["asap", "1_3_months", "3_6_months", "6_12_months", "12_plus_months", "just_browsing", "unknown", null],
        description: "Updated buying/selling timeline estimate if the activity reveals one, else null.",
      },
      suggested_action: {
        type: ["string", "null"],
        description: "A concrete next action for the agent to take, e.g. 'Call to schedule a showing this week.'",
      },
      suggested_tags: {
        type: ["array", "null"],
        items: { type: "string" },
        description:
          "Names of any tags from the provided list that this activity clearly justifies adding to the contact (e.g. an \"Agent\" tag if they mention getting licensed or wanting to join the team). Must exactly match a name from the provided list - never invent a tag that isn't in it. Empty array or null if none apply.",
      },
      confidence: {
        type: "number",
        description: "0 to 1 - how confident this read is, based on how explicit the signal was.",
      },
    },
    required: ["has_signal", "needs_reply", "summary", "confidence"],
  },
};

// Only ever writes: a new ai_insights row, and the informational
// ai_last_status_note/ai_last_analyzed_at fields on the contact. Never
// touches the contact's real stage_id/timeline directly - those changes
// are surfaced as a suggestion for the agent to Apply or Dismiss on the
// contact page (see lib/ai/apply-insight.ts).
export async function analyzeContactActivity(
  admin: SupabaseClient,
  ownerId: string,
  contactId: string,
  activity: { type: "call" | "text" | "email"; direction: string; content: string },
  activityId?: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;
  if (!activity.content || activity.content.trim().length < 3) return;

  const [{ data: contact }, { data: stages }, { data: tags }] = await Promise.all([
    admin
      .from("contacts")
      .select("first_name, last_name, contact_type, timeline, stage_id")
      .eq("id", contactId)
      .maybeSingle(),
    admin.from("pipeline_stages").select("id, name").eq("owner_id", ownerId).order("sort_order", { ascending: true }),
    admin.from("tags").select("id, name").eq("owner_id", ownerId),
  ]);
  if (!contact) return;

  const stageNames = (stages ?? []).map((s) => s.name);
  const currentStage = stages?.find((s) => s.id === contact.stage_id)?.name ?? "unknown";
  const tagList = tags ?? [];

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [INSIGHT_TOOL],
      tool_choice: { type: "tool", name: "record_insight" },
      messages: [
        {
          role: "user",
          content: `You're helping a real estate agent track leads in their CRM. Analyze this new ${activity.type} (${activity.direction}) from a contact and decide whether it changes their status.

Contact: ${contact.first_name} ${contact.last_name} (${contact.contact_type})
Current pipeline stage: ${currentStage}
Current timeline estimate: ${contact.timeline}
Available pipeline stages (suggested_stage must exactly match one of these, or be null): ${stageNames.join(", ")}
Available tags (suggested_tags must only use names from this list): ${tagList.length ? tagList.map((t) => t.name).join(", ") : "none set up yet"}

New ${activity.type}:
"""
${activity.content}
"""

Only suggest a stage/timeline change if the content actually signals it explicitly or strongly implicitly (e.g. "I'm ready to start looking" -> a more ready stage; "we're a couple months out" -> 1_3_months or 3_6_months). Don't invent signal that isn't there - it's fine for suggested_stage/suggested_timeline to be null.

Be strict about has_signal: she's already read the message herself, so only set it true when there's a real read worth handing her - not a restatement of a pleasantry. And be strict about needs_reply for inbound texts: a message that just closes things out ("ok that works", "have a good night!", "thanks!") doesn't need one.`,
        },
      ],
    });
  } catch (err) {
    console.error("AI analysis request failed", err);
    return;
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return;

  const result = toolUse.input as {
    has_signal: boolean;
    needs_reply: boolean;
    summary: string;
    suggested_stage: string | null;
    suggested_timeline: string | null;
    suggested_action: string | null;
    suggested_tags: string[] | null;
    confidence: number;
  };

  // Written regardless of has_signal - "replies owed" is about whether the
  // message itself needs an answer, independent of whether it's also
  // interesting enough to surface as a Suggested insight.
  if (activity.type === "text" && activityId) {
    await admin.from("activities").update({ needs_reply: result.needs_reply }).eq("id", activityId);
  }

  // She already read the message - only add to Suggested when there's
  // something worth handing her beyond what the text itself already said
  // (see has_signal's own description on why "ok that works" shouldn't
  // become an insight card).
  if (!result.has_signal) return;

  const suggestedStageId = result.suggested_stage
    ? stages?.find((s) => s.name === result.suggested_stage && s.name !== currentStage)?.id ?? null
    : null;
  const suggestedTimeline =
    result.suggested_timeline && result.suggested_timeline !== contact.timeline ? result.suggested_timeline : null;
  const suggestedTagIds = (result.suggested_tags ?? [])
    .map((name) => tagList.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));

  await admin.from("ai_insights").insert({
    owner_id: ownerId,
    contact_id: contactId,
    summary: result.summary,
    suggested_action: result.suggested_action,
    suggested_stage_id: suggestedStageId,
    suggested_timeline: suggestedTimeline,
    suggested_tag_ids: suggestedTagIds.length > 0 ? suggestedTagIds : null,
    confidence: result.confidence,
  });

  await admin
    .from("contacts")
    .update({ ai_last_status_note: result.summary, ai_last_analyzed_at: new Date().toISOString() })
    .eq("id", contactId);
}
