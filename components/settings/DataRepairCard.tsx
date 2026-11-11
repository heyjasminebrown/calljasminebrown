import { Section } from "@/components/ui/Section";
import { QuoSyncBackfill } from "@/components/settings/QuoSyncBackfill";
import { MissedVoicemailBackfill } from "@/components/settings/MissedVoicemailBackfill";
import { GranolaSyncBackfill } from "@/components/settings/GranolaSyncBackfill";
import { BlinqShareBackfill } from "@/components/settings/BlinqShareBackfill";
import { WebinarSignupBackfill } from "@/components/settings/WebinarSignupBackfill";
import { AutoStageRunNow } from "@/components/settings/AutoStageRunNow";
import { BacklogCleanup } from "@/components/settings/BacklogCleanup";
import { TagSuggestionBackfill } from "@/components/settings/TagSuggestionBackfill";

// The one-off backfills are the same kind of thing - catching up on
// whatever a webhook missed - and none is a daily job, so they collect
// here instead of long paragraphs dominating the page.
export function DataRepairCard() {
  return (
    <Section sectionKey="settings:data-repair" title="Data repair" meta="catch up on anything a webhook missed" defaultOpen={false}>
      <div className="space-y-3.5 px-[18px] py-4">
        <WebinarSignupBackfill />
        <QuoSyncBackfill />
        <MissedVoicemailBackfill />
        <GranolaSyncBackfill />
        <BlinqShareBackfill />
        <AutoStageRunNow />
        <BacklogCleanup />
        <TagSuggestionBackfill />
      </div>
    </Section>
  );
}
