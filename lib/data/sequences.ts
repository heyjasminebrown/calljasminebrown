import { createClient } from "@/lib/supabase/server";
import { computeDripDueAt } from "@/lib/crm/sequences";
import { resolveEmailAudience, type EmailAudienceCriteria } from "@/lib/crm/email-audience";
import type { EmailSequence, EmailSequenceStep, EmailSequenceEnrollment, Tag } from "@/types/database";

export type SequenceWithTags = EmailSequence & { targetTags: Tag[] };

export type SequenceListItem = SequenceWithTags & {
  nextSendAt: string | null; // broadcast only - earliest not-yet-fired step
  activeEnrolled: number; // drip only - contacts currently mid-sequence
  sentTotal: number;
  openRate: number;
  // A step's send_at has already passed but nothing's landed yet - either
  // the every-15-min cron hasn't ticked since, or every recipient in the
  // target tag turned out unreachable. Distinct from "Next send" (still in
  // the future) so a batch/broadcast email doesn't sit with no status at
  // all in the gap between its scheduled time and its first real send.
  sendingNow: boolean;
};

// One pass over steps/enrollments/sends instead of a per-sequence query,
// so the list page stays cheap regardless of how many sequences exist.
export async function listSequencesWithSummary(): Promise<SequenceListItem[]> {
  const supabase = await createClient();
  const [{ data: sequences }, { data: steps }, { data: enrollments }, { data: sends }, { data: allTags }] = await Promise.all([
    supabase.from("email_sequences").select("*").order("created_at", { ascending: false }),
    supabase.from("email_sequence_steps").select("sequence_id, send_at, active"),
    supabase.from("email_sequence_enrollments").select("sequence_id").eq("status", "active"),
    supabase.from("email_sequence_sends").select("sequence_id, opened_at"),
    supabase.from("tags").select("*"),
  ]);
  // target_tag_ids is an array FK, so it can't ride along on the
  // embedded-relation shorthand a single FK gets (the old ", tags(*)")
  // - one tags fetch up front, then a per-sequence id lookup below.
  const tagById = new Map((allTags ?? []).map((t) => [t.id, t as Tag]));

  const now = Date.now();
  const nextSendBySeq = new Map<string, string>();
  const dueStepBySeq = new Set<string>();
  for (const step of steps ?? []) {
    if (!step.active || !step.send_at) continue;
    if (new Date(step.send_at).getTime() <= now) {
      dueStepBySeq.add(step.sequence_id);
      continue;
    }
    const current = nextSendBySeq.get(step.sequence_id);
    if (!current || new Date(step.send_at) < new Date(current)) nextSendBySeq.set(step.sequence_id, step.send_at);
  }

  const enrolledBySeq = new Map<string, number>();
  for (const e of enrollments ?? []) enrolledBySeq.set(e.sequence_id, (enrolledBySeq.get(e.sequence_id) ?? 0) + 1);

  const sendStatsBySeq = new Map<string, { sent: number; opened: number }>();
  for (const s of sends ?? []) {
    const cur = sendStatsBySeq.get(s.sequence_id) ?? { sent: 0, opened: 0 };
    cur.sent += 1;
    if (s.opened_at) cur.opened += 1;
    sendStatsBySeq.set(s.sequence_id, cur);
  }

  return ((sequences ?? []) as EmailSequence[]).map((seq) => {
    const sendStats = sendStatsBySeq.get(seq.id) ?? { sent: 0, opened: 0 };
    return {
      ...seq,
      targetTags: seq.target_tag_ids.map((id) => tagById.get(id)).filter((t): t is Tag => !!t),
      nextSendAt: nextSendBySeq.get(seq.id) ?? null,
      activeEnrolled: enrolledBySeq.get(seq.id) ?? 0,
      sentTotal: sendStats.sent,
      openRate: sendStats.sent ? (sendStats.opened / sendStats.sent) * 100 : 0,
      sendingNow: dueStepBySeq.has(seq.id) && sendStats.sent === 0,
    };
  });
}

export type SequencesSummary = {
  activeCount: number;
  totalCount: number;
  totalEnrolled: number;
  sentLast30Days: number;
  openRateLast30Days: number;
};

export async function getAllSequencesSummary(): Promise<SequencesSummary> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: sequences }, { count: totalEnrolled }, { data: recentSends }] = await Promise.all([
    supabase.from("email_sequences").select("id, active"),
    supabase.from("email_sequence_enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("email_sequence_sends").select("opened_at").gte("sent_at", thirtyDaysAgo),
  ]);

  const sentLast30Days = recentSends?.length ?? 0;
  const openedLast30Days = (recentSends ?? []).filter((s) => s.opened_at).length;

  return {
    activeCount: (sequences ?? []).filter((s) => s.active).length,
    totalCount: sequences?.length ?? 0,
    totalEnrolled: totalEnrolled ?? 0,
    sentLast30Days,
    openRateLast30Days: sentLast30Days ? (openedLast30Days / sentLast30Days) * 100 : 0,
  };
}

export async function getSequence(id: string): Promise<SequenceWithTags | null> {
  const supabase = await createClient();
  const { data: seq } = await supabase.from("email_sequences").select("*").eq("id", id).maybeSingle();
  if (!seq) return null;
  const targetTags =
    seq.target_tag_ids.length > 0 ? ((await supabase.from("tags").select("*").in("id", seq.target_tag_ids)).data ?? []) : [];
  return { ...(seq as EmailSequence), targetTags: targetTags as Tag[] };
}

export async function getSequenceSteps(sequenceId: string): Promise<EmailSequenceStep[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });
  return (data ?? []) as EmailSequenceStep[];
}

export type StepStats = { sent: number; opened: number; clicked: number; unsubscribed: number };

export async function getSequenceStepStats(sequenceId: string): Promise<Map<string, StepStats>> {
  const supabase = await createClient();
  const { data: sends } = await supabase
    .from("email_sequence_sends")
    .select("step_id, opened_at, clicked_at, unsubscribed_at")
    .eq("sequence_id", sequenceId);

  const byStep = new Map<string, StepStats>();
  for (const send of sends ?? []) {
    const current = byStep.get(send.step_id) ?? { sent: 0, opened: 0, clicked: 0, unsubscribed: 0 };
    current.sent += 1;
    if (send.opened_at) current.opened += 1;
    if (send.clicked_at) current.clicked += 1;
    if (send.unsubscribed_at) current.unsubscribed += 1;
    byStep.set(send.step_id, current);
  }
  return byStep;
}

export type LinkClickBreakdown = {
  url: string;
  count: number;
  contacts: { id: string; first_name: string; last_name: string }[];
};

type RawLinkClick = {
  url: string;
  email_sequence_sends: {
    step_id: string;
    contacts: { id: string; first_name: string; last_name: string } | null;
  };
};

// Per-step (per email) breakdown of which specific link got clicked, how
// often, and by whom - StepStats.clicked only knows "did they click
// something in this email," this is the detail needed to see which link
// in a multi-link email (e.g. a signature with 3 links) actually gets
// used, and by which contacts specifically.
export async function getStepLinkBreakdown(sequenceId: string): Promise<Map<string, LinkClickBreakdown[]>> {
  const supabase = await createClient();
  const { data: clicks } = await supabase
    .from("email_link_clicks")
    .select("url, email_sequence_sends!inner(step_id, sequence_id, contacts(id, first_name, last_name))")
    .eq("email_sequence_sends.sequence_id", sequenceId);

  const byStep = new Map<string, Map<string, LinkClickBreakdown>>();
  for (const row of (clicks ?? []) as unknown as RawLinkClick[]) {
    const stepId = row.email_sequence_sends.step_id;
    const contact = row.email_sequence_sends.contacts;
    const stepMap = byStep.get(stepId) ?? new Map<string, LinkClickBreakdown>();
    const entry = stepMap.get(row.url) ?? { url: row.url, count: 0, contacts: [] };
    entry.count += 1;
    if (contact && !entry.contacts.some((c) => c.id === contact.id)) entry.contacts.push(contact);
    stepMap.set(row.url, entry);
    byStep.set(stepId, stepMap);
  }

  const result = new Map<string, LinkClickBreakdown[]>();
  for (const [stepId, urlMap] of byStep) {
    result.set(
      stepId,
      [...urlMap.values()].sort((a, b) => b.count - a.count),
    );
  }
  return result;
}

// All-time rollup across every step in the sequence - e.g. for a sequence
// that mixes content between two different links across its emails, which
// one actually wins overall rather than just in a single send.
export async function getSequenceLinkRollup(sequenceId: string): Promise<{ url: string; count: number }[]> {
  const supabase = await createClient();
  const { data: clicks } = await supabase
    .from("email_link_clicks")
    .select("url, email_sequence_sends!inner(sequence_id)")
    .eq("email_sequence_sends.sequence_id", sequenceId);

  const counts = new Map<string, number>();
  for (const row of (clicks ?? []) as unknown as { url: string }[]) {
    counts.set(row.url, (counts.get(row.url) ?? 0) + 1);
  }
  return [...counts.entries()].map(([url, count]) => ({ url, count })).sort((a, b) => b.count - a.count);
}

export type SequenceRollup = {
  totalSteps: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  unsubRate: number;
  bestStep: { id: string; subject: string; openRate: number } | null;
  worstStep: { id: string; subject: string; openRate: number } | null;
};

export async function getSequenceRollup(sequenceId: string): Promise<SequenceRollup> {
  const supabase = await createClient();
  const [{ data: sends }, { data: steps }] = await Promise.all([
    supabase.from("email_sequence_sends").select("step_id, opened_at, clicked_at, unsubscribed_at").eq("sequence_id", sequenceId),
    supabase.from("email_sequence_steps").select("id, subject").eq("sequence_id", sequenceId),
  ]);

  const byStep = new Map<string, { sent: number; opened: number }>();
  let totalSent = 0;
  let totalOpened = 0;
  let totalClicked = 0;
  let totalUnsubscribed = 0;
  for (const send of sends ?? []) {
    totalSent += 1;
    if (send.opened_at) totalOpened += 1;
    if (send.clicked_at) totalClicked += 1;
    if (send.unsubscribed_at) totalUnsubscribed += 1;
    const s = byStep.get(send.step_id) ?? { sent: 0, opened: 0 };
    s.sent += 1;
    if (send.opened_at) s.opened += 1;
    byStep.set(send.step_id, s);
  }

  // Only steps with a handful of sends already - a step that's fired once
  // shouldn't be crowned "best" off a single open.
  const stepRates = (steps ?? [])
    .map((step) => {
      const s = byStep.get(step.id);
      if (!s || s.sent < 3) return null;
      return { id: step.id, subject: step.subject, openRate: (s.opened / s.sent) * 100 };
    })
    .filter((s): s is { id: string; subject: string; openRate: number } => !!s);

  let bestStep: SequenceRollup["bestStep"] = null;
  let worstStep: SequenceRollup["worstStep"] = null;
  if (stepRates.length >= 2) {
    const sorted = [...stepRates].sort((a, b) => b.openRate - a.openRate);
    if (sorted[0].openRate !== sorted[sorted.length - 1].openRate) {
      bestStep = sorted[0];
      worstStep = sorted[sorted.length - 1];
    }
  }

  return {
    totalSteps: steps?.length ?? 0,
    totalSent,
    totalOpened,
    totalClicked,
    totalUnsubscribed,
    openRate: totalSent ? (totalOpened / totalSent) * 100 : 0,
    clickRate: totalSent ? (totalClicked / totalSent) * 100 : 0,
    clickToOpenRate: totalOpened ? (totalClicked / totalOpened) * 100 : 0,
    unsubRate: totalSent ? (totalUnsubscribed / totalSent) * 100 : 0,
    bestStep,
    worstStep,
  };
}

export type UpcomingBroadcastStep = EmailSequenceStep & { audienceCount: number; overdue: boolean };

// Covers both a genuinely upcoming step and one that's already due but
// hasn't sent yet (send_at has passed, sentTotal is still 0 - see
// SequenceListItem.sendingNow's comment). Surfacing the overdue case here
// too, not just future sends, is what actually answers "why isn't this
// sending": a 0 audienceCount means nobody currently matches the
// audience (often a batch's frozen snapshot came up empty), while a
// nonzero count sitting unsent points at the send path itself (Gmail
// disconnected/expired, or the cron not running) instead.
export async function getUpcomingBroadcastSteps(
  sequenceId: string,
  ownerId: string,
  criteria: EmailAudienceCriteria,
): Promise<UpcomingBroadcastStep[]> {
  const supabase = await createClient();
  const { data: steps } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  const relevant = ((steps ?? []) as EmailSequenceStep[]).filter((s) => s.active && s.send_at);
  if (relevant.length === 0) return [];

  // Real eligible count (opt-out/known-personally/exclude-aware), not
  // raw tag membership - matches what actually sends, same resolver
  // processBroadcastSequence uses.
  const { eligible } = await resolveEmailAudience(supabase, ownerId, criteria);
  return relevant.map((s) => ({ ...s, audienceCount: eligible.length, overdue: new Date(s.send_at!).getTime() <= Date.now() }));
}

export type DripEnrollmentDetail = {
  id: string;
  contact_id: string;
  enrolled_at: string;
  current_step: number;
  status: EmailSequenceEnrollment["status"];
  contact: { id: string; first_name: string; last_name: string; email: string | null } | null;
  nextSendAt: string | null;
  excluded: boolean;
  totalSteps: number;
};

type RawEnrollment = EmailSequenceEnrollment & { contacts: DripEnrollmentDetail["contact"] };

export async function getDripEnrollmentsDetailed(sequenceId: string): Promise<DripEnrollmentDetail[]> {
  const supabase = await createClient();
  const [{ data: enrollments }, { data: steps }, { data: exclusions }] = await Promise.all([
    supabase
      .from("email_sequence_enrollments")
      .select("*, contacts(id, first_name, last_name, email)")
      .eq("sequence_id", sequenceId)
      .order("enrolled_at", { ascending: false }),
    supabase.from("email_sequence_steps").select("*").eq("sequence_id", sequenceId).order("step_order", { ascending: true }),
    supabase.from("email_sequence_exclusions").select("contact_id").eq("sequence_id", sequenceId),
  ]);

  const excludedIds = new Set((exclusions ?? []).map((e) => e.contact_id));
  const stepList = (steps ?? []) as EmailSequenceStep[];

  return ((enrollments ?? []) as unknown as RawEnrollment[]).map((e) => {
    const dueAt = e.status === "active" ? computeDripDueAt(stepList, e) : null;
    return {
      id: e.id,
      contact_id: e.contact_id,
      enrolled_at: e.enrolled_at,
      current_step: e.current_step,
      status: e.status,
      contact: e.contacts,
      nextSendAt: dueAt ? dueAt.toISOString() : null,
      excluded: excludedIds.has(e.contact_id),
      totalSteps: stepList.length,
    };
  });
}

export async function getSequenceEnrollmentCount(sequenceId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("email_sequence_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("sequence_id", sequenceId)
    .eq("status", "active");
  return count ?? 0;
}

export type SequenceActivityItem = {
  id: string;
  kind: "sent" | "opened" | "clicked" | "unsubscribed";
  at: string;
  contact: { id: string; first_name: string; last_name: string } | null;
  stepSubject: string;
};

type SendActivityRow = {
  id: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
  contacts: { id: string; first_name: string; last_name: string } | null;
  email_sequence_steps: { subject: string } | null;
};

export async function getRecentSequenceActivity(sequenceId: string, limit = 20): Promise<SequenceActivityItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_sequence_sends")
    .select("id, sent_at, opened_at, clicked_at, unsubscribed_at, contacts(id, first_name, last_name), email_sequence_steps(subject)")
    .eq("sequence_id", sequenceId)
    .order("sent_at", { ascending: false })
    .limit(200);
  const sends = (data ?? []) as unknown as SendActivityRow[];

  const items: SequenceActivityItem[] = [];
  for (const send of sends) {
    const contact = send.contacts;
    const stepSubject = send.email_sequence_steps?.subject ?? "";
    items.push({ id: `${send.id}-sent`, kind: "sent", at: send.sent_at, contact, stepSubject });
    if (send.opened_at) items.push({ id: `${send.id}-opened`, kind: "opened", at: send.opened_at, contact, stepSubject });
    if (send.clicked_at) items.push({ id: `${send.id}-clicked`, kind: "clicked", at: send.clicked_at, contact, stepSubject });
    if (send.unsubscribed_at) items.push({ id: `${send.id}-unsubscribed`, kind: "unsubscribed", at: send.unsubscribed_at, contact, stepSubject });
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, limit);
}

export type SequenceExclusion = {
  excluded_at: string;
  contacts: { id: string; first_name: string; last_name: string; email: string | null } | null;
  unsubscribedFromStep: string | null;
};

type RawExclusion = { contact_id: string; excluded_at: string; contacts: SequenceExclusion["contacts"] };
type RawUnsubSend = { contact_id: string; unsubscribed_at: string; email_sequence_steps: { subject: string } | null };

export async function getSequenceExclusions(sequenceId: string): Promise<SequenceExclusion[]> {
  const supabase = await createClient();
  const [{ data: exclusions }, { data: unsubSends }] = await Promise.all([
    supabase
      .from("email_sequence_exclusions")
      .select("contact_id, excluded_at, contacts(id, first_name, last_name, email)")
      .eq("sequence_id", sequenceId)
      .order("excluded_at", { ascending: false }),
    supabase
      .from("email_sequence_sends")
      .select("contact_id, unsubscribed_at, email_sequence_steps(subject)")
      .eq("sequence_id", sequenceId)
      .not("unsubscribed_at", "is", null),
  ]);

  const stepByContact = new Map<string, string>();
  for (const send of (unsubSends ?? []) as unknown as RawUnsubSend[]) {
    stepByContact.set(send.contact_id, send.email_sequence_steps?.subject ?? "");
  }

  return ((exclusions ?? []) as unknown as RawExclusion[]).map((ex) => ({
    excluded_at: ex.excluded_at,
    contacts: ex.contacts,
    unsubscribedFromStep: stepByContact.get(ex.contact_id) || null,
  }));
}
