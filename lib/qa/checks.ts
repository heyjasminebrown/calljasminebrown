import { createClient } from "@/lib/supabase/server";
import { getDuplicateRiskPairs } from "@/lib/data/reports";
import { RATE_PRODUCT } from "@/lib/crm/rate-feed";
import { relativeTime } from "@/lib/format-time";

export type QaStatus = "ok" | "warn" | "error";

export type QaCheck = {
  id: string;
  label: string;
  status: QaStatus;
  detail: string;
  link?: string;
};

export type QaSection = {
  key: string;
  label: string;
  checks: QaCheck[];
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
}

// Every check here reads real data, not env-var presence - the Settings
// page's Connections list already shows "Connected" the moment an API key
// exists, which told her nothing when a token quietly expired or a webhook
// stopped firing. This is meant to answer "is it actually working right
// now," not "was it ever configured."
export async function getQaReport(): Promise<QaSection[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [duplicatePairs, noPhoneResult, stuckProposedResult, stuckBlastsResult, gmailResult, latestRateResult, weeklyReviewResult, sourceRecencyResult, activeSequencesResult] =
    await Promise.all([
      getDuplicateRiskPairs(),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("archived", false).eq("known_personally", false).is("phone", null),
      supabase
        .from("proposed_changes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", daysAgo(14)),
      supabase.from("text_blasts").select("id, event_name, created_at").eq("status", "sending").lt("created_at", hoursAgo(3)),
      supabase.from("gmail_accounts").select("email_address, token_expiry, connected_at").maybeSingle(),
      supabase.from("daily_rates").select("rate_date").eq("product", RATE_PRODUCT).order("rate_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("pinned_today_items").select("created_at").eq("kind", "weekly_review").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("activities")
        .select("source, occurred_at")
        .in("source", ["quo", "eventbrite", "jotform", "instagram", "blinq", "granola"])
        .order("occurred_at", { ascending: false }),
      supabase.from("email_sequences").select("id").eq("active", true),
    ]);

  const dataIntegrity: QaCheck[] = [
    {
      id: "duplicate_contacts",
      label: "Possible duplicate contacts",
      status: duplicatePairs.length > 0 ? "warn" : "ok",
      detail: duplicatePairs.length > 0 ? `${duplicatePairs.length} pair${duplicatePairs.length === 1 ? "" : "s"} share the same email or phone` : "None found",
      link: duplicatePairs.length > 0 ? "/contacts?queue=duplicate_risk" : undefined,
    },
    {
      id: "no_phone",
      label: "Contacts with no phone number",
      status: (noPhoneResult.count ?? 0) > 0 ? "warn" : "ok",
      detail: (noPhoneResult.count ?? 0) > 0 ? `${noPhoneResult.count} contacts can't be texted or called` : "Every contact has a phone number on file",
      link: (noPhoneResult.count ?? 0) > 0 ? "/contacts?phone=0" : undefined,
    },
    {
      id: "stuck_proposed_changes",
      label: "Proposed changes awaiting review",
      status: (stuckProposedResult.count ?? 0) > 0 ? "warn" : "ok",
      detail:
        (stuckProposedResult.count ?? 0) > 0
          ? `${stuckProposedResult.count} sitting unreviewed for 14+ days on a contact's timeline`
          : "Nothing sitting unreviewed for more than two weeks",
    },
    {
      id: "stuck_text_blasts",
      label: "Text blasts stuck sending",
      status: (stuckBlastsResult.data?.length ?? 0) > 0 ? "error" : "ok",
      detail:
        stuckBlastsResult.data && stuckBlastsResult.data.length > 0
          ? `"${stuckBlastsResult.data[0].event_name}" (and ${stuckBlastsResult.data.length - 1 > 0 ? `${stuckBlastsResult.data.length - 1} more` : "no others"}) still shows sending after 3+ hours - the cron may be stalled`
          : "None stuck for more than 3 hours",
      link: (stuckBlastsResult.data?.length ?? 0) > 0 ? "/sequences" : undefined,
    },
  ];

  const gmail = gmailResult.data;
  const gmailTokenStale = gmail ? new Date(gmail.token_expiry).getTime() < Date.now() - 60 * 60 * 1000 : false;

  const integrations: QaCheck[] = [
    {
      id: "gmail",
      label: "Gmail",
      status: !gmail ? "error" : gmailTokenStale ? "warn" : "ok",
      detail: !gmail
        ? "Not connected - campaigns, contact emails, and check-in recaps can't send"
        : gmailTokenStale
          ? `Connected as ${gmail.email_address}, but the access token hasn't refreshed in over an hour - reconnect if sends start failing`
          : `Connected as ${gmail.email_address}`,
      link: "/settings",
    },
    {
      id: "daily_rate_feed",
      label: "Mortgage rate feed",
      status: !process.env.FRED_API_KEY ? "ok" : !latestRateResult.data ? "warn" : new Date(latestRateResult.data.rate_date) < new Date(daysAgo(5)) ? "warn" : "ok",
      detail: !process.env.FRED_API_KEY
        ? "Not set up - rate moves are entered manually in Settings"
        : !latestRateResult.data
          ? "No rate has ever been recorded despite being configured"
          : `Last recorded ${relativeTime(latestRateResult.data.rate_date)}`,
    },
    {
      id: "weekly_review",
      label: "Weekly review email",
      status: !weeklyReviewResult.data ? "warn" : new Date(weeklyReviewResult.data.created_at) < new Date(daysAgo(9)) ? "warn" : "ok",
      detail: !weeklyReviewResult.data
        ? "Has never sent - check the weekly-review cron"
        : `Last sent ${relativeTime(weeklyReviewResult.data.created_at)}`,
    },
    {
      id: "active_sequences",
      label: "Active campaigns",
      status: "ok",
      detail: `${activeSequencesResult.data?.length ?? 0} currently active`,
      link: "/sequences",
    },
  ];

  const latestBySource = new Map<string, string>();
  for (const row of sourceRecencyResult.data ?? []) {
    if (!latestBySource.has(row.source)) latestBySource.set(row.source, row.occurred_at);
  }
  const SOURCE_LABELS: Record<string, string> = {
    quo: "Quo (calls/texts)",
    eventbrite: "Eventbrite",
    jotform: "Jotform",
    instagram: "Instagram DMs",
    blinq: "Blinq",
    granola: "Granola",
  };
  // Informational, not pass/fail - some of these are naturally low-volume
  // (Blinq only fires when she shares her card), so a long gap isn't
  // necessarily broken. Only flag genuinely long silence as worth a look.
  for (const [source, label] of Object.entries(SOURCE_LABELS)) {
    const latest = latestBySource.get(source);
    integrations.push({
      id: `source_${source}`,
      label,
      status: !latest ? "warn" : new Date(latest) < new Date(daysAgo(45)) ? "warn" : "ok",
      detail: !latest ? "No activity ever recorded from this source" : `Last activity ${relativeTime(latest)}`,
    });
  }

  return [
    { key: "data", label: "Data integrity", checks: dataIntegrity },
    { key: "integrations", label: "Integrations & scheduled jobs", checks: integrations },
  ];
}
