import type { SupabaseClient } from "@supabase/supabase-js";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";
import { sendQuoText } from "@/lib/quo/send-message";
import { upsertActivity } from "@/lib/crm/activities";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { isOptOutMessage } from "@/lib/crm/consent";
import { reportFailure } from "@/lib/errors/report-failure";

// Text campaigns built on the Campaigns page (text_campaigns, migration
// 0086). Each has a trigger (new contact with a Source, a tag added, or a
// Type / Stage it gets) and texts (steps):
//   - the first text goes out right away
//   - a reply that isn't a clear no -> that text's "on reply" step, about a
//     minute after the reply (or the campaign ends)
//   - no reply -> its "on no reply" step, N days later at a set ET time
//     (or the campaign ends)
//
// Always enforced, for every campaign: stop on STOP, a clear no, archived
// or spam, or when Jasmine texts or calls the contact herself; at most a
// couple of sends a minute; Text 1 / reply texts wait for 9 AM-8 PM ET.
//
// Nothing sends unless TEXT_AUTOMATION_ENABLED=true; a campaign switched
// off pauses its contacts where they are.

export type CampaignStep = {
  id: string;
  label: string;
  body: string;
  onReply: { next: string | null };
  onNoReply: { next: string | null; days?: number; time?: string };
};

export type TextCampaign = {
  id: string;
  name: string;
  active: boolean;
  trigger_type: "source" | "tag" | "type" | "stage";
  trigger_value: string;
  steps: CampaignStep[];
};

const MAX_SENDS_PER_RUN = 2;
const GAP_BETWEEN_SENDS_MS = 20_000;
const REPLY_DELAY_MS = 60_000;
const MAX_FAILED_ATTEMPTS = 3;
// Sends that aren't at a fixed time (Text 1, Text 2) wait for this window.
const SEND_WINDOW_START_HOUR = 9;
const SEND_WINDOW_END_HOUR = 20;

export function isTextAutomationEnabled(): boolean {
  return process.env.TEXT_AUTOMATION_ENABLED === "true";
}

// A reply counts as positive unless it's clearly a no.
const CLEAR_NO = [
  /\bnot\s+(interested|looking|right now|at (this|the) (time|moment))\b/i,
  /\bno\s+(thanks?|thank\s+you|longer|interest)\b/i,
  /\b(nope|nah|pass)\b/i,
  /\bwrong\s+(number|person)\b/i,
  /\b(remove|take)\s+me\b/i,
  /\bdon'?t\s+(text|contact|message)\b/i,
  /\bnot\s+(investing|buying)\b/i,
];

export function isClearNo(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!\s]+$/, "");
  if (["no", "n", "no sir", "no ma'am", "no maam", "not now"].includes(t)) return true;
  return CLEAR_NO.some((re) => re.test(text));
}

// "[First Name]" (as typed in the builder) or "{first_name}".
export function renderStep(body: string, firstName: string): string {
  return body.replace(/\[first name\]|\{first_name\}/gi, firstName.trim() || "there");
}

function parseTime(time: string | undefined): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [9, 0];
}

// A given Eastern-time wall-clock time, `daysAfter` days after `from`.
export function easternAt(from: Date, daysAfter: number, hour: number, minute: number): Date {
  const local = toZonedTime(from, APP_TIMEZONE);
  return fromZonedTime(new Date(local.getFullYear(), local.getMonth(), local.getDate() + daysAfter, hour, minute, 0), APP_TIMEZONE);
}

// Moves a send to 9:00 AM ET if it would land between 8 PM and 9 AM.
export function intoSendWindow(at: Date): Date {
  const hour = toZonedTime(at, APP_TIMEZONE).getHours();
  if (hour >= SEND_WINDOW_START_HOUR && hour < SEND_WINDOW_END_HOUR) return at;
  return easternAt(at, hour >= SEND_WINDOW_END_HOUR ? 1 : 0, SEND_WINDOW_START_HOUR, 0);
}

type Enrollment = {
  id: string;
  owner_id: string;
  contact_id: string;
  next_step: string | null;
  next_send_at: string | null;
  last_step: string | null;
  last_sent_at: string | null;
  sent_message_ids: string[];
  failed_attempts: number;
  enrolled_at: string;
  reply_scheduled: boolean;
  contacts: { id: string; first_name: string; phone: string | null; archived: boolean; spam: boolean; opted_out_at: string | null } | null;
  text_campaigns: TextCampaign | null;
};

type ActivityRow = {
  contact_id: string;
  type: string;
  direction: string;
  occurred_at: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
};

export async function runTextAutomation(admin: SupabaseClient, ownerId: string) {
  if (!isTextAutomationEnabled()) return { skipped: "disabled" as const };

  const { data, error } = await admin
    .from("text_automation_enrollments")
    .select("*, contacts(id, first_name, phone, archived, spam, opted_out_at), text_campaigns(id, name, active, trigger_type, trigger_value, steps)")
    .eq("owner_id", ownerId)
    .eq("status", "active");
  if (error) throw new Error(`Couldn't load text automation: ${error.message}`);
  const enrollments = (data ?? []) as Enrollment[];
  if (enrollments.length === 0) return { sent: 0, active: 0 };

  const update = async (id: string, patch: Record<string, unknown>) => {
    const { error: e } = await admin
      .from("text_automation_enrollments")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (e) await reportFailure("Text automation couldn't save progress", e.message, { enrollmentId: id });
  };
  const stop = (id: string, reason: string) => update(id, { status: "stopped", stop_reason: reason, next_step: null, next_send_at: null });

  // Everything that happened with these contacts since they were enrolled.
  const earliest = enrollments.reduce((min, e) => (e.enrolled_at < min ? e.enrolled_at : min), enrollments[0].enrolled_at);
  const { data: activityData, error: activityError } = await admin
    .from("activities")
    .select("contact_id, type, direction, occurred_at, body, metadata")
    .in("contact_id", enrollments.map((e) => e.contact_id))
    .in("type", ["text", "call"])
    .gte("occurred_at", earliest)
    .order("occurred_at");
  if (activityError) throw new Error(`Couldn't read texts for automation: ${activityError.message}`);
  const activities = (activityData ?? []) as ActivityRow[];

  const now = new Date();
  const due: Enrollment[] = [];

  for (const e of enrollments) {
    const c = e.contacts;
    const campaign = e.text_campaigns;
    if (!campaign) {
      await stop(e.id, "Campaign was deleted");
      continue;
    }
    if (!c) {
      await stop(e.id, "Contact was deleted");
      continue;
    }
    if (c.opted_out_at) {
      await stop(e.id, "Opted out");
      continue;
    }
    if (c.archived || c.spam) {
      await stop(e.id, c.archived ? "Contact archived" : "Marked spam");
      continue;
    }
    if (!c.phone) {
      await stop(e.id, "No phone number");
      continue;
    }

    const mine = activities.filter((a) => a.contact_id === e.contact_id && a.occurred_at >= e.enrolled_at);
    // Our own sends, recognized by Quo message id, our marker, or (if Quo's
    // webhook re-logged it without either) the exact campaign wording.
    const campaignTexts = new Set(campaign.steps.map((step) => renderStep(step.body, c.first_name).trim()));
    const isAutomationSend = (a: ActivityRow) => {
      const id = (a.metadata?.quo_message_id as string | undefined) ?? null;
      if (id && e.sent_message_ids.includes(id)) return true;
      if (a.metadata?.automation) return true;
      return campaignTexts.has((a.body ?? "").trim());
    };

    // Jasmine reached out herself -> hand the conversation back to her.
    if (mine.some((a) => a.direction === "outbound" && (a.type === "call" || !isAutomationSend(a)))) {
      await stop(e.id, "You texted or called them");
      continue;
    }

    // A reply since our last text.
    const reply = e.last_sent_at
      ? mine.find((a) => a.type === "text" && a.direction === "inbound" && a.occurred_at > e.last_sent_at!)
      : undefined;
    if (reply) {
      const text = reply.body ?? "";
      if (isOptOutMessage(text)) {
        await stop(e.id, "Opted out");
        continue;
      }
      if (isClearNo(text)) {
        await stop(e.id, `Replied no: "${text.slice(0, 80)}"`);
        continue;
      }
      const replyNext = campaign.steps.find((st) => st.id === e.last_step)?.onReply.next ?? null;
      if (!replyNext) {
        await update(e.id, { status: "completed", stop_reason: "Replied", next_step: null, next_send_at: null });
        continue;
      }
      if (!e.reply_scheduled) {
        const at = intoSendWindow(new Date(new Date(reply.occurred_at).getTime() + REPLY_DELAY_MS));
        await update(e.id, { next_step: replyNext, next_send_at: at.toISOString(), reply_scheduled: true });
        e.next_step = replyNext;
        e.next_send_at = at.toISOString();
        e.reply_scheduled = true;
      }
    }

    if (!campaign.active) continue; // switched off: paused where they are
    if (e.next_step && e.next_send_at && new Date(e.next_send_at) <= now) due.push(e);
  }

  // Replies first, then oldest-due first; a couple per run.
  due.sort((a, b) => Number(!!b.reply_scheduled) - Number(!!a.reply_scheduled) || a.next_send_at!.localeCompare(b.next_send_at!));

  let sent = 0;
  for (const e of due) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    const campaign = e.text_campaigns!;
    const c = e.contacts!;
    const step = campaign.steps.find((st) => st.id === e.next_step);
    if (!step) {
      await stop(e.id, "That text was removed from the campaign");
      continue;
    }
    const isFirst = campaign.steps[0]?.id === step.id;

    // Right-away and reply texts wait for the send window; scheduled ones
    // already have their own time.
    if ((isFirst || e.reply_scheduled) && intoSendWindow(now).getTime() !== now.getTime()) {
      await update(e.id, { next_send_at: intoSendWindow(now).toISOString() });
      continue;
    }

    if (sent > 0) await new Promise((r) => setTimeout(r, GAP_BETWEEN_SENDS_MS));
    const body = renderStep(step.body, c.first_name);
    const result = await sendQuoText(c.phone!, body);
    if (!result.ok) {
      const attempts = e.failed_attempts + 1;
      await reportFailure(`${campaign.name}: ${step.label} to ${c.first_name} failed`, result.error, { contactId: c.id });
      if (attempts >= MAX_FAILED_ATTEMPTS) await stop(e.id, `Couldn't send ${step.label}: ${result.error.slice(0, 200)}`);
      else await update(e.id, { failed_attempts: attempts, last_error: result.error, next_send_at: new Date(now.getTime() + 10 * 60_000).toISOString() });
      continue;
    }
    sent++;

    await upsertActivity(admin, e.owner_id, c.id, "quo", "quo_message_id", result.quoMessageId, {
      type: "text",
      direction: "outbound",
      occurred_at: new Date().toISOString(),
      body,
      metadata: { quo_message_id: result.quoMessageId, automation: campaign.id, step: step.id },
    });
    await updateEngagementTag(admin, e.owner_id, c.id);

    const sentAt = new Date();
    // A text sent because they replied ends the campaign (they're talking
    // to you now); otherwise follow its "no reply" path.
    const noReply = e.reply_scheduled ? null : step.onNoReply;
    const nextStep = noReply?.next ? campaign.steps.find((st) => st.id === noReply.next) : undefined;
    const [hour, minute] = parseTime(noReply?.time);
    const next: Record<string, unknown> = nextStep
      ? { next_step: nextStep.id, next_send_at: easternAt(sentAt, Math.max(0, noReply?.days ?? 1), hour, minute).toISOString() }
      : { status: "completed", stop_reason: `Finished after ${step.label}`, next_step: null, next_send_at: null };
    await update(e.id, {
      ...next,
      last_step: step.id,
      last_sent_at: sentAt.toISOString(),
      sent_message_ids: result.quoMessageId ? [...e.sent_message_ids, result.quoMessageId] : e.sent_message_ids,
      failed_attempts: 0,
      last_error: null,
      reply_scheduled: false,
    });
  }

  return { sent, active: enrollments.length, due: due.length };
}
