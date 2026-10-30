"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGmailMessage, textToHtml } from "@/lib/google/send-email";
import { applyMergeFields } from "@/lib/crm/sequences";
import { resolveEmailAudience, type EmailAudienceCriteria } from "@/lib/crm/email-audience";
import {
  getSequence,
  getSequenceRollup,
  getUpcomingBroadcastSteps,
  getRecentSequenceActivity,
  getSequenceExclusions,
  type SequenceRollup,
  type UpcomingBroadcastStep,
  type SequenceActivityItem,
} from "@/lib/data/sequences";
import { fullName } from "@/lib/utils";
import type { EmailSequence, EmailSequenceStep } from "@/types/database";

// Clearly-fake sample data, not her real contacts - a test send previews
// merge-field placement and tone, not a real personalization.
const PREVIEW_CONTACT = { first_name: "Jamie", last_name: "Example" };

export async function sendTestStepEmail(stepId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: step } = await supabase.from("email_sequence_steps").select("subject, body").eq("id", stepId).maybeSingle();
  if (!step) return { ok: false as const, error: "Step not found" };

  const { data: account } = await supabase.from("gmail_accounts").select("email_address").eq("owner_id", user.id).maybeSingle();
  if (!account) return { ok: false as const, error: "Connect Gmail in Settings first" };

  const admin = createAdminClient();
  const subject = `[Test] ${applyMergeFields(step.subject, PREVIEW_CONTACT)}`;
  const html = textToHtml(applyMergeFields(step.body, PREVIEW_CONTACT));
  const result = await sendGmailMessage(admin, user.id, account.email_address, subject, html);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const };
}

// Same test-send as sendTestStepEmail, but for a step that hasn't been
// saved yet - the new-step form's draft subject/body, passed straight
// through rather than read back from a saved row. Lets her check a real
// inbox render (formatting, links) before adding the step at all, not
// just after.
export async function sendTestEmailDraft(subject: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: account } = await supabase.from("gmail_accounts").select("email_address").eq("owner_id", user.id).maybeSingle();
  if (!account) return { ok: false as const, error: "Connect Gmail in Settings first" };

  const admin = createAdminClient();
  const testSubject = `[Test] ${applyMergeFields(subject, PREVIEW_CONTACT)}`;
  const html = textToHtml(applyMergeFields(body, PREVIEW_CONTACT));
  const result = await sendGmailMessage(admin, user.id, account.email_address, testSubject, html);
  if (!result.ok) return { ok: false as const, error: result.error };
  return { ok: true as const };
}

// Creates the sequence row (and, for a batch, its single step) server-side
// instead of the old client-side direct insert - a batch needs its target
// tags' current membership resolved and frozen into snapshot_contact_ids
// at exactly this moment, which the client has no business doing itself
// (it would just be reading contact_tags straight from the browser).
// Broadcast/drip leave snapshot_contact_ids null and keep resolving their
// audience live off target_tag_ids, same as before.
export async function createSequence(input: {
  name: string;
  description: string | null;
  type: "broadcast" | "drip" | "batch";
  criteria: EmailAudienceCriteria;
  batchStep?: { subject: string; body: string; sendAt: string };
  // Batch only: contact ids to leave out of the frozen snapshot - the
  // union of "recently emailed" and "also on an overlapping send"
  // exclusions the composer computed before this call.
  excludeContactIds?: string[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();

  let snapshotContactIds: string[] | null = null;
  if (input.type === "batch") {
    const { data: memberRows } = await admin.from("contact_tags").select("contact_id").in("tag_id", input.criteria.targetTagIds);
    const excludeSet = new Set(input.excludeContactIds ?? []);
    snapshotContactIds = [...new Set((memberRows ?? []).map((r) => r.contact_id as string))].filter((id) => !excludeSet.has(id));
  }

  const { data: seq, error: insertError } = await admin
    .from("email_sequences")
    .insert({
      owner_id: user.id,
      name: input.name,
      description: input.description,
      type: input.type,
      target_tag_ids: input.criteria.targetTagIds,
      exclude_tag_ids: input.criteria.excludeTagIds,
      exclude_stage_ids: input.criteria.excludeStageIds,
      exclude_timelines: input.criteria.excludeTimelines,
      snapshot_contact_ids: snapshotContactIds,
    })
    .select("id")
    .single();
  if (insertError || !seq) return { ok: false as const, error: insertError?.message ?? "Couldn't create the email." };

  if (input.type === "batch" && input.batchStep) {
    const { error: stepError } = await admin.from("email_sequence_steps").insert({
      sequence_id: seq.id,
      step_order: 0,
      subject: input.batchStep.subject,
      body: input.batchStep.body,
      send_at: input.batchStep.sendAt,
    });
    if (stepError) return { ok: false as const, error: stepError.message };
  }

  return { ok: true as const, id: seq.id as string };
}

export type AudiencePreview = {
  count: number;
  names: string[]; // capped - see below
  eligibleContactIds: string[]; // full list, not capped - for overlap checking
  excludedCount: number;
  optedOutCount: number;
  noEmailCount: number;
};

const AUDIENCE_PREVIEW_NAME_CAP = 30;

// Backs the live "who's this going to" panel in CreateSequenceForm and
// SequenceSettingsPanel - same resolveEmailAudience the actual send uses
// (lib/crm/sequences.ts's processBroadcastSequence), so what she sees
// here is exactly who gets it, not a separate approximation that could
// drift. Names are capped for a reasonable payload size; count is exact.
export async function previewEmailAudience(criteria: EmailAudienceCriteria, excludeContactIds: string[] = []): Promise<AudiencePreview> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { count: 0, names: [], eligibleContactIds: [], excludedCount: 0, optedOutCount: 0, noEmailCount: 0 };

  const admin = createAdminClient();
  const result = await resolveEmailAudience(admin, user.id, criteria);
  const excludeSet = new Set(excludeContactIds);
  const eligible = result.eligible.filter((c) => !excludeSet.has(c.id));
  return {
    count: eligible.length,
    names: eligible.slice(0, AUDIENCE_PREVIEW_NAME_CAP).map((c) => fullName(c)),
    eligibleContactIds: eligible.map((c) => c.id),
    excludedCount: result.excludedCount,
    optedOutCount: result.optedOutCount,
    noEmailCount: result.noEmailCount,
  };
}

// "Skip anyone I emailed in the last N days" - mirrors the text blast
// modal's automatic last-hour skip, but visible and configurable since a
// few days of overlap is a real, common case for email (a drip step and a
// one-off batch landing the same morning) rather than the rapid double-
// send texting guards against.
export async function getRecentlyEmailedContactIds(days: number): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || days <= 0) return [];

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("activities")
    .select("contact_id")
    .eq("owner_id", user.id)
    .eq("source", "gmail")
    .eq("type", "email")
    .eq("direction", "outbound")
    .gte("occurred_at", cutoff);
  return [...new Set((data ?? []).map((r) => r.contact_id as string))];
}

export type AudienceOverlapWarning = { sequenceName: string; sendAt: string; overlapContactIds: string[] };

// "18 of these 212 also receive House Hacking Content tomorrow" - checks
// the soonest upcoming send (next 48h) on any OTHER active broadcast/batch
// sequence and intersects its audience with the one being composed now.
// Only ever flags one campaign (the soonest), matching the single-callout
// design - a lower-priority concern than actually seeing it.
export async function checkAudienceOverlap(candidateContactIds: string[], excludeSequenceId?: string): Promise<AudienceOverlapWarning | null> {
  if (candidateContactIds.length === 0) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const windowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: sequences } = await admin
    .from("email_sequences")
    .select("*")
    .eq("owner_id", user.id)
    .eq("active", true)
    .in("type", ["broadcast", "batch"]);

  const others = ((sequences ?? []) as EmailSequence[]).filter((s) => s.id !== excludeSequenceId);
  if (others.length === 0) return null;

  const { data: allSteps } = await admin
    .from("email_sequence_steps")
    .select("*")
    .in("sequence_id", others.map((s) => s.id))
    .eq("active", true)
    .not("send_at", "is", null)
    .gt("send_at", new Date().toISOString())
    .lte("send_at", windowEnd)
    .order("send_at", { ascending: true })
    .limit(1);

  const soonest = (allSteps ?? [])[0] as EmailSequenceStep | undefined;
  if (!soonest) return null;
  const sequence = others.find((s) => s.id === soonest.sequence_id);
  if (!sequence) return null;

  const { eligible } = await resolveEmailAudience(admin, user.id, {
    targetTagIds: sequence.target_tag_ids,
    excludeTagIds: sequence.exclude_tag_ids,
    excludeStageIds: sequence.exclude_stage_ids,
    excludeTimelines: sequence.exclude_timelines,
    memberIds: sequence.type === "batch" ? (sequence.snapshot_contact_ids ?? undefined) : undefined,
  });
  const otherIds = new Set(eligible.map((c) => c.id));
  const overlapContactIds = candidateContactIds.filter((id) => otherIds.has(id));
  if (overlapContactIds.length === 0) return null;

  return { sequenceName: sequence.name, sendAt: soonest.send_at as string, overlapContactIds };
}

// Cancel a scheduled (not-yet-sent) step - same underlying write as Pause
// (processBroadcastSequence's dueSteps query already only ever picks up
// active steps), just a clearer label than reusing "Pause" for a send
// that hasn't gone out at all yet.
export async function cancelScheduledStep(stepId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("email_sequence_steps").update({ active: false }).eq("id", stepId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// "Follow up the ones who didn't open" - one tap on a finished send. Reads
// who was sent this sequence's steps but never opened any of them, and
// freezes that into a brand-new batch email's snapshot, exactly like any
// other batch. Created paused (its step's active:false) with a blank
// draft so nothing sends until she's actually written and reviewed it -
// this only sets up the audience, not the message.
export async function createNonOpenerFollowup(sequenceId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: original } = await supabase.from("email_sequences").select("name").eq("id", sequenceId).maybeSingle();
  if (!original) return { ok: false as const, error: "Sequence not found" };

  const { data: sends } = await supabase.from("email_sequence_sends").select("contact_id, opened_at").eq("sequence_id", sequenceId);
  const nonOpenerIds = [...new Set((sends ?? []).filter((s) => !s.opened_at).map((s) => s.contact_id as string))];
  if (nonOpenerIds.length === 0) return { ok: false as const, error: "Everyone who received this has opened it" };

  const admin = createAdminClient();
  const { data: seq, error: insertError } = await admin
    .from("email_sequences")
    .insert({
      owner_id: user.id,
      name: `Follow up: ${original.name}`,
      type: "batch",
      target_tag_ids: [],
      exclude_tag_ids: [],
      exclude_stage_ids: [],
      exclude_timelines: [],
      snapshot_contact_ids: nonOpenerIds,
    })
    .select("id")
    .single();
  if (insertError || !seq) return { ok: false as const, error: insertError?.message ?? "Couldn't create the follow-up" };

  const { error: stepError } = await admin.from("email_sequence_steps").insert({
    sequence_id: seq.id,
    step_order: 0,
    subject: "",
    body: "",
    send_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    active: false,
  });
  if (stepError) return { ok: false as const, error: stepError.message };

  return { ok: true as const, id: seq.id as string };
}

export async function duplicateSequence(sequenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: original } = await supabase.from("email_sequences").select("*").eq("id", sequenceId).maybeSingle();
  if (!original) return { ok: false as const, error: "Sequence not found" };

  const { data: steps } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  const { data: copy, error: insertError } = await supabase
    .from("email_sequences")
    .insert({
      owner_id: user.id,
      name: `${original.name} (copy)`,
      type: original.type,
      target_tag_ids: original.target_tag_ids,
      exclude_tag_ids: original.exclude_tag_ids,
      exclude_stage_ids: original.exclude_stage_ids,
      exclude_timelines: original.exclude_timelines,
      description: original.description,
      active: false,
    })
    .select("id")
    .single();
  if (insertError || !copy) return { ok: false as const, error: insertError?.message ?? "Couldn't duplicate" };

  if (steps && steps.length > 0) {
    const { error: stepsError } = await supabase.from("email_sequence_steps").insert(
      steps.map((s) => ({
        sequence_id: copy.id,
        step_order: s.step_order,
        subject: s.subject,
        body: s.body,
        // Broadcast/batch dates are absolute, specific to the original run -
        // copying verbatim would silently schedule the clone in the past.
        // Drip delays are relative, so they carry over fine.
        send_at: original.type === "drip" ? s.send_at : null,
        delay_amount: s.delay_amount,
        delay_unit: s.delay_unit,
        active: s.active,
      })),
    );
    if (stepsError) return { ok: false as const, error: stepsError.message };
  }

  return { ok: true as const, id: copy.id as string };
}

export type CampaignReportData = {
  rollup: SequenceRollup;
  upcomingSteps: UpcomingBroadcastStep[];
  activity: SequenceActivityItem[];
  optedOutCount: number;
  nonOpenerCount: number;
};

// Backs the chevron-expanded row on the Campaigns list - the exact same
// three components the old per-sequence page composed (SequenceOverviewStats,
// UpcomingBroadcastPanel, RecentActivityFeed), fetched on demand instead of
// a full page load just to check how a send is doing.
export async function getCampaignReportData(sequenceId: string): Promise<CampaignReportData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sequence = await getSequence(sequenceId);
  if (!sequence) return null;

  const [rollup, upcomingSteps, activity, exclusions, sends] = await Promise.all([
    getSequenceRollup(sequenceId),
    sequence.type !== "drip"
      ? getUpcomingBroadcastSteps(sequenceId, user.id, {
          targetTagIds: sequence.target_tag_ids,
          excludeTagIds: sequence.exclude_tag_ids,
          excludeStageIds: sequence.exclude_stage_ids,
          excludeTimelines: sequence.exclude_timelines,
          memberIds: sequence.type === "batch" ? (sequence.snapshot_contact_ids ?? undefined) : undefined,
        })
      : Promise.resolve([]),
    getRecentSequenceActivity(sequenceId, 10),
    getSequenceExclusions(sequenceId),
    supabase.from("email_sequence_sends").select("opened_at").eq("sequence_id", sequenceId),
  ]);

  const nonOpenerCount = (sends.data ?? []).filter((s) => !s.opened_at).length;

  return { rollup, upcomingSteps, activity, optedOutCount: exclusions.length, nonOpenerCount };
}
