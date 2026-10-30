import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { extractFromTranscript, type RawProposal } from "@/lib/ai/summarize-call";
import { patchActivityMetadata } from "@/lib/crm/activities";
import type { MeetingTranscript, MeetingTranscriptSource, ProposedChange, TranscriptParticipant } from "@/types/database";

export async function getTranscriptWithProposals(
  transcriptId: string,
): Promise<{ transcript: MeetingTranscript; proposals: ProposedChange[] } | null> {
  const supabase = await createClient();

  const [{ data: transcript }, { data: proposals }] = await Promise.all([
    supabase.from("meeting_transcripts").select("*").eq("id", transcriptId).maybeSingle(),
    supabase.from("proposed_changes").select("*").eq("transcript_id", transcriptId).eq("status", "pending").order("created_at", { ascending: true }),
  ]);

  if (!transcript) return null;
  return { transcript: transcript as MeetingTranscript, proposals: (proposals ?? []) as ProposedChange[] };
}

// Most recent ready transcript for a contact that still has pending
// proposals - the contact page shows at most one panel at a time, the
// freshest one worth reviewing.
export async function getLatestReadyTranscriptForContact(
  contactId: string,
): Promise<{ transcript: MeetingTranscript; proposals: ProposedChange[] } | null> {
  const supabase = await createClient();

  const { data: transcripts } = await supabase
    .from("meeting_transcripts")
    .select("id")
    .eq("contact_id", contactId)
    .eq("status", "ready")
    .order("occurred_at", { ascending: false })
    .limit(5);

  for (const t of transcripts ?? []) {
    const result = await getTranscriptWithProposals(t.id);
    if (result && result.proposals.length > 0) return result;
  }
  return null;
}

// --- Admin-client writes, called from webhook routes (no user session to
// read cookies from - see the lesson from Phase 2's weekly-review cron).

// Same insert-first, catch-23505, fall-back-to-select pattern
// upsertActivity (lib/crm/activities.ts) already proved out - this table
// exists specifically to stop the "webhook fires twice" bug from
// repeating, so it gets the same real-unique-index atomicity, not a
// select-then-insert race.
export async function createOrGetTranscript(
  admin: SupabaseClient,
  input: {
    ownerId: string;
    contactId: string | null;
    source: MeetingTranscriptSource;
    externalId: string;
    rawPayload: Record<string, unknown>;
    participants?: TranscriptParticipant[];
    durationSeconds?: number | null;
    occurredAt: string;
  },
): Promise<{ id: string; wasCreated: boolean }> {
  const basePayload = {
    owner_id: input.ownerId,
    contact_id: input.contactId,
    source: input.source,
    external_id: input.externalId,
    raw_payload: input.rawPayload,
    participants: input.participants ?? [],
    duration_seconds: input.durationSeconds ?? null,
    occurred_at: input.occurredAt,
  };

  const { data: created, error } = await admin.from("meeting_transcripts").insert(basePayload).select("id").maybeSingle();
  if (!error) return { id: created!.id as string, wasCreated: true };
  if (error.code !== "23505") throw error;

  const { data: existing } = await admin
    .from("meeting_transcripts")
    .select("id")
    .eq("owner_id", input.ownerId)
    .eq("source", input.source)
    .eq("external_id", input.externalId)
    .maybeSingle();

  return { id: existing!.id as string, wasCreated: false };
}

type ExtractionContact = {
  first_name: string;
  last_name: string;
  budget_min: number | null;
  budget_max: number | null;
  timeline: string;
  areas_of_interest: string[];
  stage_id: string | null;
  decision_maker: string | null;
  objection: string | null;
};

function normalizeProposal(
  p: RawProposal,
  stages: { id: string; name: string }[],
  tags: { id: string; name: string }[],
  contact: ExtractionContact,
) {
  let proposedValue: Record<string, unknown> = {};
  let currentValue: Record<string, unknown> | null = null;

  switch (p.field) {
    case "budget":
      proposedValue = { min: p.budget_min, max: p.budget_max };
      currentValue = contact.budget_min || contact.budget_max ? { min: contact.budget_min, max: contact.budget_max } : null;
      break;
    case "timeline":
      proposedValue = { timeline: p.timeline_value };
      currentValue = { timeline: contact.timeline };
      break;
    case "areas_of_interest":
      proposedValue = { area: p.text_value };
      break;
    case "decision_maker":
      proposedValue = { text: p.text_value };
      currentValue = contact.decision_maker ? { text: contact.decision_maker } : null;
      break;
    case "objection":
      proposedValue = { text: p.text_value };
      currentValue = contact.objection ? { text: contact.objection } : null;
      break;
    case "note":
      proposedValue = { text: p.text_value };
      break;
    case "showing":
      proposedValue = { address: p.text_value };
      break;
    case "task":
      proposedValue = { title: p.task_title, dueAt: p.task_due_date };
      break;
    case "stage": {
      const stage = stages.find((s) => s.name === p.stage_name);
      proposedValue = { stageId: stage?.id ?? null, stageName: p.stage_name };
      break;
    }
    case "tag": {
      const tag = tags.find((t) => t.name.toLowerCase() === (p.text_value ?? "").toLowerCase());
      proposedValue = { tagId: tag?.id ?? null, name: tag?.name ?? p.text_value };
      break;
    }
  }

  return {
    field: p.field,
    proposed_value: proposedValue,
    current_value: currentValue,
    quote: p.quote,
    timestamp_seconds: p.timestamp_seconds,
    speaker: p.speaker,
    confidence: p.confidence,
  };
}

// Runs the wide extraction against a stored transcript and writes
// proposed_changes - called via after() from a webhook route, so it's
// never on the critical path of the request that triggered it (the
// design brief's "extraction runs async; the panel appears when it's
// ready, not on the request"). Shared by every transcript source (Quo
// calls; Granola for video meetings, in-person notes, and phone calls) -
// only the participantNames hint differs.
export async function runExtraction(
  admin: SupabaseClient,
  ownerId: string,
  transcriptId: string,
  contactId: string,
  transcript: string,
  participantNames?: string[],
): Promise<void> {
  const [{ data: contact }, { data: stages }, { data: tags }, { data: transcriptRow }] = await Promise.all([
    admin
      .from("contacts")
      .select("first_name, last_name, budget_min, budget_max, timeline, areas_of_interest, stage_id, decision_maker, objection, known_personally")
      .eq("id", contactId)
      .maybeSingle(),
    admin.from("pipeline_stages").select("id, name").eq("owner_id", ownerId).order("sort_order", { ascending: true }),
    admin.from("tags").select("id, name").eq("owner_id", ownerId),
    admin.from("meeting_transcripts").select("source, external_id").eq("id", transcriptId).maybeSingle(),
  ]);

  if (!contact) {
    await admin.from("meeting_transcripts").update({ status: "failed" }).eq("id", transcriptId);
    return;
  }

  // Belt and suspenders - callers are expected to check this before even
  // scheduling extraction, but never generate suggestions for a
  // known-personally contact even if something calls this directly.
  if (contact.known_personally) {
    await admin.from("meeting_transcripts").update({ status: "no_proposals" }).eq("id", transcriptId);
    return;
  }

  const stageList = (stages ?? []) as { id: string; name: string }[];
  const tagList = (tags ?? []) as { id: string; name: string }[];
  const currentStageName = stageList.find((s) => s.id === contact.stage_id)?.name ?? "unknown";

  const extraction = await extractFromTranscript(transcript, {
    contactName: `${contact.first_name} ${contact.last_name}`.trim(),
    currentBudgetMin: contact.budget_min,
    currentBudgetMax: contact.budget_max,
    currentTimeline: contact.timeline,
    currentAreasOfInterest: contact.areas_of_interest ?? [],
    currentStageName,
    availableStageNames: stageList.map((s) => s.name),
    availableTagNames: tagList.map((t) => t.name),
    participantNames,
  });

  if (!extraction) {
    await admin.from("meeting_transcripts").update({ status: "failed" }).eq("id", transcriptId);
    return;
  }

  // Quo calls already show a "Call summary" card (components/messages/
  // CallLogEntry.tsx) sourced from activities.metadata.ai_call_summary -
  // this used to be populated synchronously by the now-narrower
  // generateCallSummary. Keep it working, just from this one wider call
  // instead of a second separate one, patched onto the original call
  // activity by the same dedupe key patchActivityMetadata already looks
  // up by. Only applies to Quo - Granola transcripts don't have an
  // existing card like this to preserve.
  if (transcriptRow?.source === "quo" && extraction.summaryBullets.length > 0) {
    await patchActivityMetadata(admin, ownerId, "quo", "quo_call_id", transcriptRow.external_id, {
      ai_call_summary: { bullets: extraction.summaryBullets, nextSteps: [] },
    });
  }

  const rows = extraction.proposals
    .map((p) => normalizeProposal(p, stageList, tagList, contact))
    // A "stage" proposal whose stage_name didn't match any real stage is
    // useless (and dangerous - applying it would clear the contact's
    // stage rather than change it), so it's dropped rather than shown.
    // Same idea for "tag" - a name that doesn't match anything on her
    // list is dropped rather than shown as an uneditable no-op.
    .filter((r) => r.field !== "stage" || (r.proposed_value as { stageId: string | null }).stageId)
    .filter((r) => r.field !== "tag" || (r.proposed_value as { tagId: string | null }).tagId);

  if (rows.length === 0) {
    await admin.from("meeting_transcripts").update({ status: "no_proposals", summary_bullets: extraction.summaryBullets }).eq("id", transcriptId);
    return;
  }

  await admin.from("proposed_changes").insert(rows.map((r) => ({ ...r, transcript_id: transcriptId })));
  await admin.from("meeting_transcripts").update({ status: "ready", summary_bullets: extraction.summaryBullets }).eq("id", transcriptId);
}
