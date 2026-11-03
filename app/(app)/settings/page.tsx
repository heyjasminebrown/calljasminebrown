import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// The Data repair backfills below (Blinq especially) can make a real
// number of Gmail API round trips - raises the ceiling on how long a
// Server Action invoked from this page is allowed to run, same reason
// send-text-blasts' cron route sets this. Only a ceiling, not a forced
// wait - every other action here still returns as fast as it always did.
export const maxDuration = 60;
import { listStages, listTags } from "@/lib/data/contacts";
import { listTextTemplates } from "@/lib/data/text-templates";
import { PipelineStagesAndTags } from "@/components/settings/PipelineStagesAndTags";
import { TextTemplatesManager } from "@/components/settings/TextTemplatesManager";
import { ConnectionsCard, type ConnectionRow } from "@/components/settings/ConnectionsCard";
import { QaReportCard } from "@/components/settings/QaReportCard";
import { getQaReport } from "@/lib/qa/checks";
import { NotificationsCard } from "@/components/settings/NotificationsCard";
import { GmailConnect } from "@/components/settings/GmailConnect";
import { QuoSyncBackfill } from "@/components/settings/QuoSyncBackfill";
import { GranolaConnect } from "@/components/settings/GranolaConnect";
import { GranolaMatchingSettings } from "@/components/settings/GranolaMatchingSettings";
import { RateManualEntry } from "@/components/settings/RateManualEntry";
import { DataRepairCard } from "@/components/settings/DataRepairCard";
import { OptOutList } from "@/components/settings/OptOutList";
import { SpamFiltersCard } from "@/components/settings/SpamFiltersCard";
import { KnownPersonallyList } from "@/components/settings/KnownPersonallyList";
import { SignOutButton } from "@/components/nav/SignOutButton";
import { RATE_PRODUCT } from "@/lib/crm/rate-feed";
import { getDisabledSpamReasons } from "@/lib/crm/spam-signals";
import { Card, Button } from "@/components/ui";
import { BarChart3, Download } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const params = await searchParams;
  const granolaWebhookUrl =
    process.env.GRANOLA_WEBHOOK_SECRET && process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL}/api/webhooks/granola?secret=${process.env.GRANOLA_WEBHOOK_SECRET}`
      : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [stages, tags, textTemplates, gmailAccount, warmSettings, granolaMatchingSettings, latestRate, stageCountRows, qaSections] = await Promise.all([
    listStages(),
    listTags(),
    listTextTemplates(),
    supabase.from("gmail_accounts").select("email_address").maybeSingle().then((r) => r.data),
    supabase.from("warm_notification_settings").select("*").maybeSingle().then((r) => r.data),
    supabase.from("granola_matching_settings").select("*").maybeSingle().then((r) => r.data),
    supabase
      .from("daily_rates")
      .select("rate_pct, rate_date")
      .eq("product", RATE_PRODUCT)
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    supabase.from("contacts").select("stage_id").eq("archived", false).then((r) => r.data),
    getQaReport(),
  ]);

  // Opt-outs used to be visible only one contact at a time (ConsentStatus
  // on their profile) or as an ephemeral count inside a blast's audience
  // preview - no persistent, browsable list existed anywhere to review or
  // re-subscribe someone from.
  const { data: optedOutRows } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, opted_out_at")
    .not("opted_out_at", "is", null)
    .order("opted_out_at", { ascending: false });
  const optedOutContacts = (optedOutRows ?? []).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`.trim(),
    optedOutAt: c.opted_out_at as string,
  }));

  const [disabledSpamReasons, { data: allowlistRows }, { data: knownPersonallyRows }] = await Promise.all([
    user ? getDisabledSpamReasons(supabase, user.id) : Promise.resolve(new Set<string>()),
    supabase.from("spam_number_allowlist").select("id, phone, created_at").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, first_name, last_name").eq("known_personally", true).order("first_name", { ascending: true }),
  ]);
  const allowlist = (allowlistRows ?? []).map((r) => ({ id: r.id as string, phone: r.phone as string, createdAt: r.created_at as string }));
  const knownPersonallyContacts = (knownPersonallyRows ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim() }));

  const stageCounts: Record<string, number> = {};
  for (const row of stageCountRows ?? []) {
    if (!row.stage_id) continue;
    stageCounts[row.stage_id] = (stageCounts[row.stage_id] ?? 0) + 1;
  }

  const connectionRows: ConnectionRow[] = [
    {
      key: "gmail",
      name: "Gmail and Calendar",
      description: "Email on each timeline, sending from a contact, calendar invites, campaigns.",
      status: gmailAccount ? "Connected" : "Not connected",
      connected: !!gmailAccount,
      manageContent: (
        <div className="space-y-3">
          <p className="text-[15px] leading-[22px] text-neutral-600">
            Syncs email to and from contacts already in your CRM to their timeline, lets you send email and schedule calls
            from a contact&apos;s profile, and powers scheduled email campaigns.
          </p>
          <GmailConnect connectedEmail={gmailAccount?.email_address ?? null} errorCode={params.gmail_error} />
          <Link href="/sequences" className="block md:hidden">
            <Button variant="secondary" size="sm">
              Manage campaigns
            </Button>
          </Link>
        </div>
      ),
    },
    {
      key: "quo",
      name: "Quo",
      description: "Calls and texts log automatically. New contacts push back so calls show a name.",
      status: process.env.QUO_API_KEY ? "Connected" : "Not set up",
      connected: !!process.env.QUO_API_KEY,
      manageContent: <QuoSyncBackfill />,
    },
    {
      key: "granola",
      name: "Granola",
      description: "Meetings, in-person notes and phone memos become changes you approve.",
      status: granolaWebhookUrl ? "Connected" : "Not set up",
      connected: !!granolaWebhookUrl,
      manageContent: (
        <div className="space-y-3.5">
          <GranolaConnect webhookUrl={granolaWebhookUrl} />
          <div className="border-t border-neutral-100 pt-3.5">
            <GranolaMatchingSettings settings={granolaMatchingSettings} />
          </div>
        </div>
      ),
    },
    {
      key: "calendly",
      name: "Calendly",
      description: "Built, needs setup.",
      status: process.env.CALENDLY_API_TOKEN ? "Connected" : "Not set up",
      connected: !!process.env.CALENDLY_API_TOKEN,
      manageContent: (
        <p className="text-[15px] leading-[22px] text-neutral-600">
          See the README&apos;s &quot;Setting up Calendly&quot; section for the setup steps — nothing to configure here yet.
        </p>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-neutral-900">Settings</h1>
        {user?.email && <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-600">{user.email}</p>}
      </div>

      <Link href="/reports" className="block md:hidden">
        <Button variant="secondary" size="sm">
          <BarChart3 size={14} /> View reports
        </Button>
      </Link>

      {user && <PipelineStagesAndTags stages={stages} tags={tags} ownerId={user.id} stageCounts={stageCounts} />}

      {user && (
        <Card id="text-templates">
          <TextTemplatesManager templates={textTemplates} ownerId={user.id} />
        </Card>
      )}

      <ConnectionsCard rows={connectionRows} />

      <QaReportCard sections={qaSections} />

      <NotificationsCard warmSettings={warmSettings} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />

      <Card>
        <RateManualEntry latestRatePct={latestRate?.rate_pct ?? null} latestRateDate={latestRate?.rate_date ?? null} />
      </Card>

      <OptOutList contacts={optedOutContacts} />

      <SpamFiltersCard disabledReasons={[...disabledSpamReasons]} allowlist={allowlist} />

      <KnownPersonallyList contacts={knownPersonallyContacts} />

      <DataRepairCard />

      <div className="flex items-center gap-2.5 border-t border-neutral-100 pt-4">
        <a href="/api/contacts/export">
          <Button variant="secondary" size="sm">
            <Download size={14} /> Export all contacts
          </Button>
        </a>
        <SignOutButton className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-semibold" />
      </div>
    </div>
  );
}
