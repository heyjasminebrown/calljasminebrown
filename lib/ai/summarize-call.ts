import Anthropic from "@anthropic-ai/sdk";
import type { ProposedField } from "@/types/database";

const MODEL = "claude-haiku-4-5-20251001";

const SUMMARY_TOOL = {
  name: "record_call_summary",
  description: "Records a structured summary of a phone call transcript for a real estate agent's CRM.",
  input_schema: {
    type: "object" as const,
    properties: {
      bullets: {
        type: "array",
        items: { type: "string" },
        description: "2-5 short, factual bullet points capturing what was actually discussed on the call.",
      },
      next_steps: {
        type: "array",
        items: { type: "string" },
        description: "0-3 concrete follow-up actions mentioned or implied by the call. Empty array if none.",
      },
    },
    required: ["bullets", "next_steps"],
  },
};

export type CallSummary = { bullets: string[]; nextSteps: string[] };

// Superseded for call transcripts by extractFromTranscript below (Phase 3) -
// left in place only because the Quo webhook's call.transcript.completed
// branch still calls it until that's rewired in the stop that wires up
// Source 1. Not used by anything new.
export async function generateCallSummary(transcript: string): Promise<CallSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !transcript || transcript.trim().length < 10) return null;

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: "record_call_summary" },
      messages: [
        {
          role: "user",
          content: `Summarize this real estate agent's phone call transcript for a CRM call log. Be concise and factual - only include what was actually said.

Transcript:
"""
${transcript}
"""`,
        },
      ],
    });
  } catch (err) {
    console.error("Call summary generation failed", err);
    return null;
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const result = toolUse.input as { bullets: string[]; next_steps: string[] };
  if (!result.bullets?.length) return null;

  return { bullets: result.bullets, nextSteps: result.next_steps ?? [] };
}

// --- Phase 3: wide extraction for anything with a transcript (Quo calls;
// Granola for video meetings, in-person notes, and phone calls) - see
// lib/data/meeting-transcripts.ts for how proposals get written and
// approved. Deliberately NOT used for inbound texts: analyzeContactActivity
// in analyze-contact.ts keeps serving that lighter single-suggestion flow
// unchanged, since a text message doesn't carry enough content for most of
// these fields to make sense.

const TIMELINE_VALUES = ["asap", "1_3_months", "3_6_months", "6_12_months", "12_plus_months", "just_browsing", "unknown"] as const;

// Below this, an item is dropped before it's ever returned - "dropped
// rather than shown" per the design brief, not filtered client-side.
const CONFIDENCE_THRESHOLD = 0.6;

const EXTRACTION_TOOL = {
  name: "record_transcript_proposals",
  description:
    "Records a structured extraction of a real estate conversation transcript: a short summary plus individually-approvable proposed changes to the contact's CRM record. Every proposal must be traceable to an exact quote.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary_bullets: {
        type: "array",
        items: { type: "string" },
        description: "2-5 short, factual bullet points capturing what was actually discussed.",
      },
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: ["budget", "timeline", "areas_of_interest", "decision_maker", "objection", "note", "task", "stage", "showing", "tag"],
              description:
                "budget: a range or ceiling was stated. timeline: buying/selling timeframe. areas_of_interest: a neighborhood/area they're interested in (one per proposal, never replaces existing areas). decision_maker: who else is involved in the decision and what they control. objection: a concern or hesitation, captured close to verbatim. note: anything else worth keeping on the record that doesn't fit another field (pre-approval details, property type, bedroom/must-have preferences, etc). task: something the agent committed to doing, with a due date if one was stated or clearly implied. stage: only when the pipeline stage should clearly change - omit rather than guess. showing: the agent showed this person a specific property in person - use the property's address as the text. tag: the conversation clearly justifies one of the provided existing tag names (e.g. they mention getting licensed and wanting to join the team -> \"Agent\") - text_value must exactly match a name from the provided tag list, never a new name.",
            },
            text_value: {
              type: ["string", "null"],
              description:
                "The proposed text for decision_maker, objection, note, a single area name for areas_of_interest, the property address for showing, or the exact existing tag name for tag.",
            },
            budget_min: { type: ["number", "null"] },
            budget_max: { type: ["number", "null"] },
            timeline_value: { type: ["string", "null"], enum: [...TIMELINE_VALUES, null] },
            task_title: { type: ["string", "null"] },
            task_due_date: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD) if a due date was stated or clearly implied, else null." },
            stage_name: { type: ["string", "null"], description: "Must exactly match one of the provided available stage names." },
            quote: { type: "string", description: "The exact sentence this proposal came from." },
            timestamp_seconds: { type: ["number", "null"], description: "Seconds into the recording the quote occurs, if the transcript has timestamps." },
            speaker: { type: ["string", "null"], description: "Who said it, if the transcript labels speakers." },
            confidence: { type: "number", description: "0 to 1 - how explicit and unambiguous the signal was." },
          },
          required: ["field", "quote", "confidence"],
        },
      },
    },
    required: ["summary_bullets", "proposals"],
  },
};

export type RawProposal = {
  field: ProposedField;
  text_value: string | null;
  budget_min: number | null;
  budget_max: number | null;
  timeline_value: string | null;
  task_title: string | null;
  task_due_date: string | null;
  stage_name: string | null;
  quote: string;
  timestamp_seconds: number | null;
  speaker: string | null;
  confidence: number;
};

export type TranscriptExtraction = { summaryBullets: string[]; proposals: RawProposal[] };

export type TranscriptContext = {
  contactName: string;
  currentBudgetMin: number | null;
  currentBudgetMax: number | null;
  currentTimeline: string;
  currentAreasOfInterest: string[];
  currentStageName: string;
  availableStageNames: string[];
  availableTagNames: string[];
  participantNames?: string[];
};

export async function extractFromTranscript(transcript: string, context: TranscriptContext): Promise<TranscriptExtraction | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !transcript || transcript.trim().length < 10) return null;

  const client = new Anthropic({ apiKey });

  const budgetLine =
    context.currentBudgetMin || context.currentBudgetMax
      ? `$${context.currentBudgetMin ?? "?"}-$${context.currentBudgetMax ?? "?"}`
      : "not on file";

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "record_transcript_proposals" },
      messages: [
        {
          role: "user",
          content: `You're helping a real estate agent get everything worth keeping out of a recorded conversation with ${context.contactName}, without inventing anything that wasn't actually said. Today's date is ${new Date().toISOString().slice(0, 10)}.

What's already on ${context.contactName}'s record:
- Budget: ${budgetLine}
- Timeline: ${context.currentTimeline}
- Areas of interest: ${context.currentAreasOfInterest.join(", ") || "none on file"}
- Pipeline stage: ${context.currentStageName}
${context.participantNames?.length ? `- Other people on this call/meeting: ${context.participantNames.join(", ")}` : ""}

Available pipeline stages (a "stage" proposal's stage_name must exactly match one of these): ${context.availableStageNames.join(", ")}
Available tags (a "tag" proposal's text_value must exactly match one of these, or omit the proposal entirely if none fit): ${context.availableTagNames.length ? context.availableTagNames.join(", ") : "none set up yet"}

Transcript:
"""
${transcript}
"""

Only propose a change when the transcript actually states it - don't propose "was blank" fields just because they weren't mentioned, and don't propose a field that already matches what's on file. Every proposal needs its own exact quote. Confidence should reflect how explicit and unambiguous the statement was, not how important the field is.`,
        },
      ],
    });
  } catch (err) {
    console.error("Transcript extraction failed", err);
    return null;
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const result = toolUse.input as { summary_bullets: string[]; proposals: RawProposal[] };
  const proposals = (result.proposals ?? []).filter((p) => p.confidence >= CONFIDENCE_THRESHOLD);

  return { summaryBullets: result.summary_bullets ?? [], proposals };
}
