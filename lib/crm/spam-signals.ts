import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";

// Text-match spam detection for inbound Quo calls. Runs twice per call: once
// at call.completed (summary/transcript usually don't exist yet - a 12-second
// robocall has nothing to read), and again once call.transcript.completed /
// call.summary.completed actually deliver text. Reasons are fixed strings
// shown verbatim in the Spam bucket UI, so keep them stable once shipped.
const RULES: { reason: string; patterns: RegExp[] }[] = [
  {
    reason: "Google listing / verification",
    patterns: [
      /google listing/i,
      /google business/i,
      /google voice/i,
      /business listing/i,
      /unverified/i,
      /verify your business/i,
      /(listing|business) (information|information's|details) (is|are) incorrect/i,
      /incorrect (business )?information/i,
    ],
  },
  {
    // Generic IVR script - "press 9/1/0 to speak to a[n] agent/representative"
    // - regardless of what the pitch behind it turns out to be. Real leads
    // don't leave voicemails narrating a phone menu at themselves; a
    // recorded prompt reading itself into a voicemail is spam on its own.
    reason: "Robocall IVR (\"press # for an agent\")",
    patterns: [/press \d.{0,60}(agent|representative|specialist|someone|live person|customer service)/i, /press \d.{0,15}(now|to continue|to speak|to be connected)/i],
  },
  {
    // The TCPA-mandated opt-out line at the end of a robocall script - "press
    // 9 to opt out" or just "to opt out or call ..." - shows up even when the
    // recording got cut off before the actual pitch, so the transcript has
    // nothing else to match on. A real caller never says this to a real
    // estate agent's voicemail; hearing it at all means it's a recording.
    reason: "Robocall opt-out script",
    patterns: [/\bopt out\b/i, /press \d.{0,20}opt.?out/i],
  },
  { reason: "Business loans / funding", patterns: [/business loan/i, /working capital/i, /\bfunding\b/i, /merchant advance/i, /line of credit/i] },
  { reason: "Taxes / IRS", patterns: [/\birs\b/i, /tax relief/i, /back taxes/i, /tax settlement/i] },
  { reason: "Solar", patterns: [/\bsolar\b/i] },
  { reason: "Insurance / Medicare", patterns: [/medicare/i, /health plan/i, /final expense/i, /auto warranty insurance/i] },
  { reason: "SEO / web design", patterns: [/\bseo\b/i, /web design/i, /website redesign/i, /rank your site/i, /marketing services/i] },
  { reason: "Extended warranty", patterns: [/extended warranty/i, /vehicle warranty/i] },
  { reason: "Merchant services / card processing", patterns: [/merchant services/i, /card processing/i, /payment processing/i, /lower your rates/i] },
  { reason: "Staffing / recruiting pitches", patterns: [/\bstaffing\b/i, /recruiting services/i, /hire offshore/i, /virtual assistant agency/i] },
];

export const MISSED_STATUSES = new Set(["missed", "no-answer", "no_answer", "busy", "voicemail"]);

const ROBOCALL_REASON = "Robocall, no voicemail";

// Settings → Spam filters lists exactly these ten, each independently
// toggleable (see spam_rule_overrides) - the regex-matched ones above plus
// the repeat-attempts rule, which has no pattern list of its own.
export const ALL_SPAM_RULE_REASONS: string[] = [...RULES.map((r) => r.reason), ROBOCALL_REASON];

export type SpamCheckInput = {
  summary: string | null;
  transcript: string | null;
  durationSeconds: number | null;
  status: string | null;
  hasVoicemail: boolean;
  // Set by the caller from a quick count of this contact's recent missed
  // inbound calls with no voicemail - detectSpam itself has no DB access,
  // so it can't compute this. Omit (or leave false) outside that check.
  repeatedInboundNoVoicemail?: boolean;
  // Rules she's turned off in Settings → Spam filters (by reason string) -
  // skipped entirely rather than matched-but-ignored, so a disabled rule
  // truly never flags anything.
  disabledReasons?: Set<string>;
};

export type SpamCheckResult = { isSpam: boolean; reason: string | null };

// Deliberately NOT included, per the owner: "unknown number, call under 15
// seconds" - short calls from real leads are common, and flagging on
// duration/unknown-number alone would bury genuine leads in the bucket.
export function detectSpam(input: SpamCheckInput): SpamCheckResult {
  const disabled = input.disabledReasons;
  const text = [input.summary, input.transcript].filter(Boolean).join("\n");
  for (const rule of RULES) {
    if (disabled?.has(rule.reason)) continue;
    if (rule.patterns.some((p) => p.test(text))) {
      return { isSpam: true, reason: rule.reason };
    }
  }

  const missed = input.status ? MISSED_STATUSES.has(input.status.toLowerCase()) : false;
  if (!disabled?.has(ROBOCALL_REASON) && missed && !input.hasVoicemail && input.repeatedInboundNoVoicemail) {
    return { isSpam: true, reason: ROBOCALL_REASON };
  }

  return { isSpam: false, reason: null };
}

export async function getDisabledSpamReasons(admin: SupabaseClient, ownerId: string): Promise<Set<string>> {
  const { data } = await admin.from("spam_rule_overrides").select("reason").eq("owner_id", ownerId).eq("enabled", false);
  return new Set((data ?? []).map((r) => r.reason as string));
}

export async function setSpamRuleEnabled(admin: SupabaseClient, ownerId: string, reason: string, enabled: boolean): Promise<void> {
  await admin.from("spam_rule_overrides").upsert({ owner_id: ownerId, reason, enabled }, { onConflict: "owner_id,reason" });
}

// What "Not spam" writes to (spam-actions.ts's markNotSpam) and what the
// webhook checks before ever running detectSpam - a number here is never
// re-flagged by any rule again, regardless of what a future call from it
// says.
export async function isNumberAllowlisted(admin: SupabaseClient, ownerId: string, phone: string | null): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const { data } = await admin.from("spam_number_allowlist").select("id").eq("owner_id", ownerId).eq("phone", normalized).maybeSingle();
  return !!data;
}

export async function addToSpamAllowlist(admin: SupabaseClient, ownerId: string, phone: string | null): Promise<void> {
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  await admin.from("spam_number_allowlist").upsert({ owner_id: ownerId, phone: normalized }, { onConflict: "owner_id,phone" });
}

export async function listAllowlistedPhoneKeys(client: SupabaseClient, ownerId?: string): Promise<Set<string>> {
  let query = client.from("spam_number_allowlist").select("phone");
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data } = await query;
  return new Set((data ?? []).map((r) => r.phone as string).filter(Boolean));
}

const BURST_WINDOW_HOURS = 3;
const BURST_THRESHOLD = 2;

// The "robocall, no voicemail" rule's repeat-attempts signal - detectSpam
// itself has no DB access, so this runs as a separate query the caller
// folds into repeatedInboundNoVoicemail.
//
// This used to be scoped to one contact's own call history, on the
// assumption a robodialer keeps re-calling from the same number. Real
// robocall campaigns commonly rotate through a fresh, similar-looking
// local number on every attempt instead (caller-ID spoofing) - each one
// creates its own bare contact with exactly one call ever, so a
// per-contact count could never reach the threshold no matter how many
// calls actually came in. This counts missed inbound calls account-wide
// instead: 2+ *other* unrelated missed calls in a tight 3-hour window is
// a burst hitting the line, not several different people happening to
// miss connecting with her at once.
export async function hasRecentMissedCallBurst(admin: SupabaseClient, ownerId: string): Promise<boolean> {
  const since = new Date(Date.now() - BURST_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("activities")
    .select("id, metadata")
    .eq("owner_id", ownerId)
    .eq("type", "call")
    .eq("direction", "inbound")
    .gte("occurred_at", since);
  const missedCount = (data ?? []).filter((a) => {
    const status = typeof a.metadata?.status === "string" ? a.metadata.status.toLowerCase() : null;
    return status != null && MISSED_STATUSES.has(status);
  }).length;
  return missedCount >= BURST_THRESHOLD;
}
