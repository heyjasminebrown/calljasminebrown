"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuoText } from "@/lib/quo/send-message";
import { sendGmailMessage, textToHtml } from "@/lib/google/send-email";
import { upsertActivity } from "@/lib/crm/activities";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { findOrCreateContact, addTagByName, loadMatchCandidates } from "@/lib/crm/find-or-create-contact";
import { syncContactToQuo } from "@/lib/quo/sync-contact";
import { listGranolaNoteIds, fetchGranolaNote } from "@/lib/granola/client";
import { processGranolaNote } from "@/lib/granola/process-note";
import type { GranolaNoteEvent } from "@/lib/granola/parse-event";
import { backfillBlinqShares } from "@/lib/google/backfill-blinq";
import { runAutoStage } from "@/lib/crm/auto-stage";
import type { ParsedContactRow } from "@/lib/crm/bulk-import-contacts";
import { applyStageChange } from "@/lib/crm/stage-transition";
import type { PipelineStage, RelationshipType } from "@/types/database";

const QUO_BACKFILL_BATCH_SIZE = 25;
const GRANOLA_BACKFILL_LOOKBACK_DAYS = 90;

export async function sendTextToContact(contactId: string, toNumber: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  // Confirm this contact actually belongs to the signed-in user before
  // sending anything on their behalf (RLS would also block a mismatched
  // read/write, this just fails fast with a clear message).
  const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
  if (!contact) return { ok: false as const, error: "Contact not found" };

  const result = await sendQuoText(toNumber, body);
  if (!result.ok) return { ok: false as const, error: result.error };

  const admin = createAdminClient();
  await upsertActivity(admin, user.id, contactId, "quo", "quo_message_id", result.quoMessageId, {
    type: "text",
    direction: "outbound",
    occurred_at: new Date().toISOString(),
    body,
    metadata: { quo_message_id: result.quoMessageId, sent_from_crm: true },
  });
  await updateEngagementTag(admin, user.id, contactId);

  return { ok: true as const };
}

// The mobile Log sheet's full spec (outcome + next-follow-up) - a real
// superset of what AddActivityForm saves today (type/direction/body
// only, no outcome or follow-up scheduling). AddActivityForm itself is
// left as-is; this is the Log sheet's own action.
export async function logActivityWithOutcome(input: {
  contactId: string;
  type: import("@/types/database").ActivityType;
  body: string | null;
  outcome?: "connected" | "no_answer" | "left_voicemail";
  nextFollowUpAt?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: contact } = await supabase.from("contacts").select("id").eq("id", input.contactId).maybeSingle();
  if (!contact) return { ok: false as const, error: "Contact not found" };

  const { error } = await supabase.from("activities").insert({
    owner_id: user.id,
    contact_id: input.contactId,
    type: input.type,
    direction: "none",
    body: input.body,
    source: "manual",
    metadata: input.outcome ? { outcome: input.outcome } : {},
  });
  if (error) return { ok: false as const, error: error.message };

  if (input.nextFollowUpAt !== undefined) {
    const { error: followUpError } = await supabase.from("contacts").update({ next_follow_up_at: input.nextFollowUpAt }).eq("id", input.contactId);
    if (followUpError) return { ok: false as const, error: followUpError.message };
  }

  return { ok: true as const };
}

export async function sendEmailToContact(contactId: string, toEmail: string, subject: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
  if (!contact) return { ok: false as const, error: "Contact not found" };

  const admin = createAdminClient();
  const result = await sendGmailMessage(admin, user.id, toEmail, subject, textToHtml(body));
  if (!result.ok) return { ok: false as const, error: result.error };

  await upsertActivity(admin, user.id, contactId, "gmail", "gmail_message_id", result.messageId, {
    type: "email",
    direction: "outbound",
    occurred_at: new Date().toISOString(),
    body: `${subject}\n\n${body}`,
    metadata: { gmail_message_id: result.messageId, subject, sent_from_crm: true },
  });
  // Engagement is deliberately scoped to calls/texts only (see
  // lib/crm/engagement.ts) - email volume is a different pattern (e.g. a
  // sequence firing several at once shouldn't look like sudden engagement).

  return { ok: true as const };
}

export async function bulkImportContacts(
  rows: ParsedContactRow[],
  tagName: string | null,
  leadSource: string,
  // The import's defaults, used when a row has no Type / Stage column value.
  // stageName null = no stage.
  defaults: { relationshipType: RelationshipType; stageName: string | null },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  // The signed-in user's own client (row-level security scopes it to their
  // contacts), not the service-role admin client - importing shouldn't
  // depend on SUPABASE_SERVICE_ROLE_KEY, which is only needed for webhooks.
  // The modal sends rows in batches, so each call stays well inside the
  // serverless time limit.
  let candidates;
  try {
    candidates = await loadMatchCandidates(supabase, user.id);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Couldn't load contacts" };
  }
  const { data: stagesData, error: stagesError } = await supabase.from("pipeline_stages").select("*").eq("owner_id", user.id);
  if (stagesError) return { ok: false as const, error: `Couldn't load stages: ${stagesError.message}` };
  const stages = (stagesData ?? []) as PipelineStage[];
  const stageByName = (name: string | null) => (name ? stages.find((s) => s.name.toLowerCase() === name.toLowerCase()) : undefined);
  if (defaults.stageName && !stageByName(defaults.stageName)) {
    return { ok: false as const, error: `Stage "${defaults.stageName}" doesn't exist - check Settings → Pipeline stages` };
  }
  let created = 0;
  let matched = 0;
  let failed = 0;

  // Sequential, not Promise.all - two rows for the same person must not
  // both miss each other and create duplicates.
  for (const row of rows) {
    const result = await findOrCreateContact(supabase, user.id, {
      email: row.email,
      secondaryEmail: row.secondaryEmail,
      phone: row.phone,
      firstName: row.firstName,
      lastName: row.lastName,
      leadSource,
      leadDate: row.leadDate,
      skipQuoSync: true,
      candidates,
      relationshipType: row.relationshipType ?? defaults.relationshipType,
      stageId: stageByName(row.stageName ?? defaults.stageName)?.id ?? null,
    });
    if (!result) {
      failed++;
      continue;
    }
    // Someone already on file keeps their Type and Stage unless the file
    // itself sets them for that row. A stage move goes through
    // applyStageChange like any manual move; history is never touched.
    if (result.existing) {
      const existing = result.existing;
      if (row.relationshipType && row.relationshipType !== existing.relationship_type) {
        const { error } = await supabase.from("contacts").update({ relationship_type: row.relationshipType }).eq("id", existing.id);
        if (error) return { ok: false as const, error: `Couldn't update type for row ${row.line}: ${error.message}` };
        existing.relationship_type = row.relationshipType;
      }
      const newStage = stageByName(row.stageName);
      if (newStage && newStage.id !== existing.stage_id) {
        const oldStage = stages.find((s) => s.id === existing.stage_id);
        const { error } = await applyStageChange(supabase, user.id, existing.id, oldStage, newStage);
        if (error) return { ok: false as const, error: `Couldn't update stage for row ${row.line}: ${error.message}` };
        existing.stage_id = newStage.id;
      }
    }
    if (result.wasCreated) created++;
    else matched++;
    if (tagName) await addTagByName(supabase, user.id, result.id, tagName);
  }

  return { ok: true as const, created, matched, failed };
}

// Folds `mergeId` into `keepId` - calls, texts, deals, tasks, notes, tags,
// and sequence history all move over, then the duplicate row is deleted.
// See supabase/migrations/0021_merge_contacts.sql for exactly what moves.
export async function mergeContacts(keepId: string, mergeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const { error } = await supabase.rpc("merge_contacts", { keep_id: keepId, merge_id: mergeId, actor_id: user.id });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}

// Fired from ContactForm right after a manual save so Quo picks up the
// name/number without waiting for the next backfill run.
export async function syncContactToQuoAction(contactId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, email, quo_contact_id")
    .eq("id", contactId)
    .maybeSingle();
  if (contact) await syncContactToQuo(admin, contact);
}

// One click in Settings syncs a batch of never-synced contacts, so a big
// backlog doesn't risk timing out a single request. Returns how many are
// left so the button can say "click again" instead of silently stopping.
export async function backfillQuoSync() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  const { data: batch } = await admin
    .from("contacts")
    .select("id, first_name, last_name, phone, email, quo_contact_id")
    .eq("owner_id", user.id)
    .eq("archived", false)
    .is("quo_synced_at", null)
    .not("phone", "is", null)
    .limit(QUO_BACKFILL_BATCH_SIZE);

  let synced = 0;
  let failed = 0;
  for (const contact of batch ?? []) {
    const result = await syncContactToQuo(admin, contact);
    if (result.ok) synced++;
    else failed++;
  }

  const { count: remaining } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("archived", false)
    .is("quo_synced_at", null)
    .not("phone", "is", null);

  return { ok: true as const, synced, failed, remaining: remaining ?? 0 };
}

// One click in Settings catches up on registrations a broken/missing
// webhook subscription missed - pulls every placed order from the last 90
// days on both Eventbrite accounts and runs them through the exact same
// contact-matching/tagging logic the live webhook uses, just without
// notifications (see notifyNewLead's comment on why bulk syncs stay silent).
// Manual "sync recent notes" button in Settings for whenever the live
// Granola webhook missed a note (never fired at all, or fired before the
// note had a generated transcript and no later event followed up).
// Reuses processGranolaNote - the same match/create/extract logic the
// webhook itself calls - so this can't drift from live behavior, and
// createOrGetTranscript's own dedupe on (owner, source, note id) makes
// re-running this safe: an already-synced note is a no-op, not a
// duplicate.
export async function backfillGranolaNotes() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  if (!process.env.GRANOLA_API_KEY) return { ok: false as const, error: "GRANOLA_API_KEY is not configured" };

  const admin = createAdminClient();
  const since = new Date(Date.now() - GRANOLA_BACKFILL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let noteIds: string[];
  try {
    noteIds = await listGranolaNoteIds(since);
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Unknown error" };
  }

  let processed = 0;
  let notReady = 0;
  let failed = 0;

  for (const noteId of noteIds) {
    let note;
    try {
      note = await fetchGranolaNote(noteId);
    } catch {
      failed++;
      continue;
    }
    if (!note || !note.transcriptText) {
      notReady++;
      continue;
    }

    const event: GranolaNoteEvent = {
      noteId,
      title: note.title ?? "Meeting",
      transcript: note.transcriptText,
      summary: note.summary ?? "",
      occurredAt: note.occurredAt ?? new Date().toISOString(),
      durationSeconds: null,
      calendarEventId: note.calendarEventId,
      participants: note.participants,
    };

    await processGranolaNote(admin, user.id, event, { note });
    processed++;
  }

  return { ok: true as const, notes: noteIds.length, processed, notReady, failed };
}

export async function backfillBlinq() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  const result = await backfillBlinqShares(admin, user.id);
  if (!result) return { ok: false as const, error: "Connect Gmail first (Settings > Connections)" };

  return { ok: true as const, found: result.found, added: result.added, capped: result.capped };
}

// Lets her trigger the same reconciliation the hourly auto-stage cron runs,
// instead of waiting up to an hour for it - same runAutoStage the cron
// calls, just invoked from a Settings click with the signed-in user's id.
export async function runAutoStageNow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in" };

  const admin = createAdminClient();
  const { moved } = await runAutoStage(admin, user.id);
  return { ok: true as const, moved };
}
