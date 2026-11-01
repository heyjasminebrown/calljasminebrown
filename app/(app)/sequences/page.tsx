import { listSequencesWithSummary, getAllSequencesSummary } from "@/lib/data/sequences";
import { listTags, listStages, listLeadSources } from "@/lib/data/contacts";
import { getAllTextBlasts } from "@/app/(app)/contacts/text-blast-actions";
import { CreateSequenceForm } from "@/components/sequences/CreateSequenceForm";
import { NewTextButton } from "@/components/sequences/NewTextButton";
import { SequencesDashboard } from "@/components/sequences/SequencesDashboard";
import { CampaignsList } from "@/components/sequences/CampaignsList";
import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/ui/Section";
import { TextCampaignsPanel, type CampaignRow, type EnrollmentRow } from "@/components/sequences/TextCampaignsPanel";
import { isTextAutomationEnabled } from "@/lib/crm/text-automation";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [sequences, tags, stages, summary, blasts, enrollments, textCampaigns, sources] = await Promise.all([
    listSequencesWithSummary(),
    listTags(),
    listStages(),
    getAllSequencesSummary(),
    getAllTextBlasts(),
    supabase
      .from("text_automation_enrollments")
      .select("id, contact_id, campaign_id, status, stop_reason, next_step, next_send_at, last_error, contacts(first_name, last_name)")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.from("text_campaigns").select("id, name, active, trigger_type, trigger_value, steps").order("created_at"),
    listLeadSources(),
  ]);
  const campaignRows = (textCampaigns.data ?? []) as CampaignRow[];
  const onCount = campaignRows.filter((c) => c.active).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">Campaigns</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Scheduled campaigns, drips, one-off emails and texts to your contacts.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <NewTextButton tags={tags} preloadedIds={ids} autoOpenIds={ids} />
        </div>
      </div>

      <Section sectionKey="campaigns:text-campaigns" title="Automated text campaigns" meta={`${onCount} on`}>
        <div className="p-[18px]">
          {textCampaigns.error || enrollments.error ? (
            <p className="text-sm text-red-600">
              Couldn&apos;t load text campaigns: {(textCampaigns.error ?? enrollments.error)!.message}
            </p>
          ) : (
            <TextCampaignsPanel
              campaigns={campaignRows}
              enrollments={(enrollments.data ?? []) as unknown as EnrollmentRow[]}
              sendingEnabled={isTextAutomationEnabled()}
              tags={tags}
              stages={stages}
              sources={sources}
            />
          )}
        </div>
      </Section>

      {summary.totalCount > 0 && <SequencesDashboard summary={summary} />}

      {user && <CreateSequenceForm tags={tags} stages={stages} ownerId={user.id} />}

      <CampaignsList sequences={sequences} blasts={blasts} tags={tags} />
    </div>
  );
}
