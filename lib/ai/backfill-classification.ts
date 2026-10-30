import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const MODEL = "claude-haiku-4-5-20251001";

// One-time cleanup for the backlog that predates has_signal/needs_reply
// (lib/ai/analyze-contact.ts) - those only classify new activity going
// forward, so this re-runs the same judgment against what's already on
// file: the standing Replies Owed backlog and the standing Suggested
// cards. Deliberately its own lightweight classifier rather than
// reusing analyzeContactActivity, since re-running that on an old text
// would insert a brand-new ai_insights row for it - this only ever
// updates needs_reply on the activity itself, or dismisses an existing
// insight, never creates one.

type ClassifierTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

const REPLY_TOOL: ClassifierTool = {
  name: "classify_reply",
  description: "Classifies whether an inbound text message needs a reply.",
  input_schema: {
    type: "object",
    properties: {
      needs_reply: {
        type: "boolean",
        description:
          "True if this message is waiting on a reply - it asks a question, makes a request, or leaves something open. False if it closes the exchange and needs nothing further - a goodbye, a thank-you, a simple acknowledgment/confirmation like \"ok that works\" or \"sounds good\".",
      },
    },
    required: ["needs_reply"],
  },
};

const SIGNAL_TOOL: ClassifierTool = {
  name: "classify_signal",
  description: "Classifies whether a CRM insight summary is worth surfacing to a real estate agent as a heads-up.",
  input_schema: {
    type: "object",
    properties: {
      has_signal: {
        type: "boolean",
        description:
          "True if this reveals something genuinely worth a heads-up - a new timeline/budget/concern, a stage-worthy update. False if it's just a restatement of a plain conversational close or acknowledgment with no real signal (e.g. someone said thanks, confirmed a time works, said goodnight).",
      },
    },
    required: ["has_signal"],
  },
};

async function classifyBoolean(client: Anthropic, tool: ClassifierTool, field: string, prompt: string): Promise<boolean | null> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 128,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content: prompt }],
    });
    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const input = toolUse.input as Record<string, unknown>;
    return typeof input[field] === "boolean" ? (input[field] as boolean) : null;
  } catch (err) {
    console.error("Backfill classification request failed", err);
    return null;
  }
}

// Same "latest text per contact" definition getRepliesOwedGroup uses -
// only that row's needs_reply actually affects what shows on the list.
export async function backfillNeedsReply(admin: SupabaseClient, ownerId: string): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 0;
  const client = new Anthropic({ apiKey });

  const { data } = await admin
    .from("activities")
    .select("id, contact_id, direction, body, needs_reply, occurred_at, contacts!inner(archived)")
    .eq("owner_id", ownerId)
    .eq("type", "text")
    .eq("contacts.archived", false)
    .order("occurred_at", { ascending: false })
    .limit(1000);

  const seen = new Set<string>();
  let classified = 0;

  for (const row of data ?? []) {
    if (seen.has(row.contact_id)) continue;
    seen.add(row.contact_id);

    if (row.direction !== "inbound") continue;
    if (row.needs_reply !== null) continue;
    if (!row.body || row.body.trim().length < 3) continue;

    const needsReply = await classifyBoolean(
      client,
      REPLY_TOOL,
      "needs_reply",
      `Does this text message need a reply from the person who received it?\n\n"""\n${row.body}\n"""`,
    );
    if (needsReply === null) continue;

    await admin.from("activities").update({ needs_reply: needsReply }).eq("id", row.id);
    classified++;
  }

  return classified;
}

// Dismisses (never deletes - same reversible pattern the Dismiss button
// itself uses) any standing, non-dismissed insight whose summary reads
// as a plain restatement rather than real signal.
export async function backfillInsightSignal(admin: SupabaseClient, ownerId: string): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 0;
  const client = new Anthropic({ apiKey });

  const { data } = await admin
    .from("ai_insights")
    .select("id, summary")
    .eq("owner_id", ownerId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(200);

  let dismissedCount = 0;

  for (const row of data ?? []) {
    if (!row.summary) continue;

    const hasSignal = await classifyBoolean(
      client,
      SIGNAL_TOOL,
      "has_signal",
      `A CRM generated this insight summary for a real estate agent to review. Is it worth surfacing, or is it just a restatement of a plain conversational close/acknowledgment?\n\n"""\n${row.summary}\n"""`,
    );
    if (hasSignal !== false) continue;

    await admin.from("ai_insights").update({ dismissed: true }).eq("id", row.id);
    dismissedCount++;
  }

  return dismissedCount;
}

// One-time sweep of contacts' EXISTING texts/calls against the live
// suggested_tags classifier (lib/ai/analyze-contact.ts) - that one only
// looks at brand-new activity going forward, so a contact whose old
// conversation already implied a tag (e.g. a call from before "Agent"
// existed as a tag at all) would otherwise never surface. One Anthropic
// call per contact (recent activity aggregated, not per-message) to keep
// the call count bounded by contact count rather than message count.
// Marks every contact it looks at via tag_suggestions_backfilled_at
// regardless of outcome, so a Run click only ever advances through the
// backlog - repeated clicks page through it in BATCH_SIZE chunks rather
// than one giant request that risks the serverless timeout.
const BATCH_SIZE = 60;
const MAX_CONTENT_CHARS = 6000;

const TAG_SUGGESTION_TOOL = {
  name: "suggest_tags",
  description: "Suggests which of a real estate agent's existing CRM tags apply to a contact, based on their past texts and calls.",
  input_schema: {
    type: "object" as const,
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description:
          "Names of any tags from the provided list that this contact's past conversations clearly justify. Must exactly match a name from the list - never invent one. Empty array if none apply.",
      },
    },
    required: ["tags"],
  },
};

function activityContent(a: { type: string; body: string | null; metadata: Record<string, unknown> | null }): string | null {
  if (a.type === "text") return a.body;
  const summary = a.metadata?.ai_call_summary as { bullets?: string[] } | undefined;
  if (summary?.bullets?.length) return summary.bullets.join(". ");
  const transcript = a.metadata?.transcript;
  if (typeof transcript === "string" && transcript.trim().length > 0) return transcript;
  return a.body;
}

export async function backfillSuggestedTags(
  admin: SupabaseClient,
  ownerId: string,
): Promise<{ processed: number; suggested: number; remaining: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { processed: 0, suggested: 0, remaining: 0 };

  const { data: tags } = await admin.from("tags").select("id, name").eq("owner_id", ownerId);
  const tagList = tags ?? [];
  if (tagList.length === 0) return { processed: 0, suggested: 0, remaining: 0 };

  const { count: totalPending } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .is("tag_suggestions_backfilled_at", null);

  const { data: contacts } = await admin
    .from("contacts")
    .select("id, contact_tags(tag_id)")
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .is("tag_suggestions_backfilled_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!contacts || contacts.length === 0) return { processed: 0, suggested: 0, remaining: 0 };

  const client = new Anthropic({ apiKey });
  let suggestedCount = 0;

  for (const contact of contacts) {
    const existingTagIds = new Set((contact.contact_tags ?? []).map((ct: { tag_id: string }) => ct.tag_id));
    const candidateTags = tagList.filter((t) => !existingTagIds.has(t.id));

    if (candidateTags.length > 0) {
      const { data: activities } = await admin
        .from("activities")
        .select("type, body, metadata")
        .eq("owner_id", ownerId)
        .eq("contact_id", contact.id)
        .in("type", ["text", "call"])
        .order("occurred_at", { ascending: false })
        .limit(30);

      let content = "";
      for (const a of activities ?? []) {
        const piece = activityContent(a as { type: string; body: string | null; metadata: Record<string, unknown> | null });
        if (!piece) continue;
        if (content.length + piece.length > MAX_CONTENT_CHARS) break;
        content += `${piece}\n`;
      }

      if (content.trim().length >= 20) {
        try {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 256,
            tools: [TAG_SUGGESTION_TOOL],
            tool_choice: { type: "tool", name: "suggest_tags" },
            messages: [
              {
                role: "user",
                content: `Based only on this real estate contact's past texts and calls, which of these existing tags apply? Available tags: ${candidateTags.map((t) => t.name).join(", ")}\n\nPast conversations:\n"""\n${content}\n"""`,
              },
            ],
          });
          const toolUse = response.content.find((b) => b.type === "tool_use");
          if (toolUse && toolUse.type === "tool_use") {
            const result = toolUse.input as { tags: string[] };
            const matched = (result.tags ?? [])
              .map((name) => candidateTags.find((t) => t.name.toLowerCase() === name.toLowerCase()))
              .filter((t): t is { id: string; name: string } => Boolean(t));

            if (matched.length > 0) {
              await admin.from("ai_insights").insert({
                owner_id: ownerId,
                contact_id: contact.id,
                summary: `Past conversations suggest tagging as ${matched.map((t) => t.name).join(", ")}.`,
                suggested_tag_ids: matched.map((t) => t.id),
                confidence: 0.7,
              });
              suggestedCount++;
            }
          }
        } catch (err) {
          console.error("Tag suggestion backfill request failed", err);
        }
      }
    }

    await admin.from("contacts").update({ tag_suggestions_backfilled_at: new Date().toISOString() }).eq("id", contact.id);
  }

  return {
    processed: contacts.length,
    suggested: suggestedCount,
    remaining: Math.max(0, (totalPending ?? 0) - contacts.length),
  };
}
