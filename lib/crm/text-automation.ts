import type { SupabaseClient } from "@supabase/supabase-js";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIMEZONE } from "@/lib/format-time";
import { sendQuoText } from "@/lib/quo/send-message";
import { upsertActivity } from "@/lib/crm/activities";
import { updateEngagementTag } from "@/lib/crm/engagement";
import { isOptOutMessage } from "@/lib/crm/consent";
import { reportFailure } from "@/lib/errors/report-failure";

// "Conventus Text Campaign" - started for every new contact whose source
// is Conventus (DB trigger, migration 0085).
//
//   Text 1  right away.
//     reply (not a clear no) -> Text 2, one minute after the reply
//     no reply              -> Text 3, next day 4:30 PM ET
//   Text 3
//     reply (not a clear no) -> Text 2, one minute after the reply
//     no reply              -> Text 4, one week later 5:45 PM ET
//   Text 2 / Text 4 end the campaign.
//
// It stops for a contact who opts out (STOP), replies with a clear no, is
// archived or marked spam, or whom Jasmine texts or calls herself.
//
// Nothing sends unless TEXT_AUTOMATION_ENABLED=true (turned on after A2P
// approval). Sends are throttled to a couple a minute so a batch of
// contacts never goes out all at once.

export const TEXT_CAMPAIGNS = {
  conventus: {
    name: "Conventus Text Campaign",
    steps: {
      t1: "Hey {first_name}, it's Jasmine 🙂. I came across a recent project of yours, but wasn't sure if you were looking for your next deal by chance?",
      t2: "Oh nice! Depending on what you're looking for, I might be a good resource for your next deal. I'll give you a quick call to hear more.",
      t3: "Curious if you've got your next project lined up already or if you're still looking?",
      t4: "Are you still investing right now, or taking a little break between projects?",
    },
  },
} as const;

type Campaign = keyof typeof TEXT_CAMPAIGNS;
type Step = "t1" | "t2" | "t3" | "t4";

export const STEP_LABELS: Record<Step, string> = { t1: "Text 1", t2: "Text 2", t3: "Text 3", t4: "Text 4" };

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

function render(campaign: Campaign, step: Step, firstName: string): string {
  return TEXT_CAMPAIGNS[campaign].steps[step].replace("{first_name}", firstName.trim() || "there");
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
  campaign: Campaign;
  next_step: Step | null;
  next_send_at: string | null;
  last_step: Step | null;
  last_sent_at: string | null;
  sent_message_ids: string[];
  failed_attempts: number;
  enrolled_at: string;
  contacts: { id: string; first_name: string; phone: string | null; archived: boolean; spam: boolean; opted_out_at: string | null } | null;
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
    .select("*, contacts(id, first_name, phone, archived, spam, opted_out_at)")
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
    const campaignTexts = new Set((Object.keys(TEXT_CAMPAIGNS[e.campaign].steps) as Step[]).map((step) => render(e.campaign, step, c.first_name).trim()));
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
      if (e.last_step === "t1" || e.last_step === "t3") {
        if (isClearNo(text)) {
          await stop(e.id, `Replied no: "${text.slice(0, 80)}"`);
          continue;
        }
        if (e.next_step !== "t2") {
          const at = intoSendWindow(new Date(new Date(reply.occurred_at).getTime() + REPLY_DELAY_MS));
          await update(e.id, { next_step: "t2", next_send_at: at.toISOString() });
          e.next_step = "t2";
          e.next_send_at = at.toISOString();
        }
      } else {
        await update(e.id, { status: "completed", stop_reason: "Replied", next_step: null, next_send_at: null });
        continue;
      }
    }

    if (e.next_step && e.next_send_at && new Date(e.next_send_at) <= now) due.push(e);
  }

  // Replies (Text 2) first, then oldest-due first; a couple per run.
  due.sort((a, b) => (a.next_step === "t2" ? 0 : 1) - (b.next_step === "t2" ? 0 : 1) || a.next_send_at!.localeCompare(b.next_send_at!));

  let sent = 0;
  for (const e of due) {
    if (sent >= MAX_SENDS_PER_RUN) break;
    const step = e.next_step!;
    const c = e.contacts!;

    if ((step === "t1" || step === "t2") && intoSendWindow(now).getTime() !== now.getTime()) {
      await update(e.id, { next_send_at: intoSendWindow(now).toISOString() });
      continue;
    }

    if (sent > 0) await new Promise((r) => setTimeout(r, GAP_BETWEEN_SENDS_MS));
    const body = render(e.campaign, step, c.first_name);
    const result = await sendQuoText(c.phone!, body);
    if (!result.ok) {
      const attempts = e.failed_attempts + 1;
      await reportFailure(`${TEXT_CAMPAIGNS[e.campaign].name}: ${STEP_LABELS[step]} to ${c.first_name} failed`, result.error, { contactId: c.id });
      if (attempts >= MAX_FAILED_ATTEMPTS) await stop(e.id, `Couldn't send ${STEP_LABELS[step]}: ${result.error.slice(0, 200)}`);
      else await update(e.id, { failed_attempts: attempts, last_error: result.error, next_send_at: new Date(now.getTime() + 10 * 60_000).toISOString() });
      continue;
    }
    sent++;

    await upsertActivity(admin, e.owner_id, c.id, "quo", "quo_message_id", result.quoMessageId, {
      type: "text",
      direction: "outbound",
      occurred_at: new Date().toISOString(),
      body,
      metadata: { quo_message_id: result.quoMessageId, automation: e.campaign, step },
    });
    await updateEngagementTag(admin, e.owner_id, c.id);

    const sentAt = new Date();
    const next: Record<string, unknown> =
      step === "t1"
        ? { next_step: "t3", next_send_at: easternAt(sentAt, 1, 16, 30).toISOString() }
        : step === "t3"
          ? { next_step: "t4", next_send_at: easternAt(sentAt, 7, 17, 45).toISOString() }
          : { status: "completed", stop_reason: step === "t2" ? "Sent Text 2 - call them" : "Finished (Text 4 sent)", next_step: null, next_send_at: null };
    await update(e.id, {
      ...next,
      last_step: step,
      last_sent_at: sentAt.toISOString(),
      sent_message_ids: result.quoMessageId ? [...e.sent_message_ids, result.quoMessageId] : e.sent_message_ids,
      failed_attempts: 0,
      last_error: null,
    });
  }

  return { sent, active: enrollments.length, due: due.length };
}
