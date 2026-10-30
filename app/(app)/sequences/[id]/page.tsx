import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSequence,
  getSequenceSteps,
  getSequenceStepStats,
  getSequenceRollup,
  getUpcomingBroadcastSteps,
  getDripEnrollmentsDetailed,
  getRecentSequenceActivity,
  getSequenceExclusions,
  getStepLinkBreakdown,
  getSequenceLinkRollup,
} from "@/lib/data/sequences";
import { listContacts, listTags, listStages } from "@/lib/data/contacts";
import { StepManager } from "@/components/sequences/StepManager";
import { SequenceToggle } from "@/components/sequences/SequenceToggle";
import { SequenceSettingsPanel } from "@/components/sequences/SequenceSettingsPanel";
import { SequenceOverviewStats } from "@/components/sequences/SequenceOverviewStats";
import { LinkPerformancePanel } from "@/components/sequences/LinkPerformancePanel";
import { UpcomingBroadcastPanel } from "@/components/sequences/UpcomingBroadcastPanel";
import { EnrollmentManager } from "@/components/sequences/EnrollmentManager";
import { RecentActivityFeed } from "@/components/sequences/RecentActivityFeed";
import { Card, Badge } from "@/components/ui";
import { formatLocal } from "@/lib/format-time";
import { fullName } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [sequence, steps, stats, rollup, exclusions, tags, stages, linkBreakdown, linkRollup] = await Promise.all([
    getSequence(id),
    getSequenceSteps(id),
    getSequenceStepStats(id),
    getSequenceRollup(id),
    getSequenceExclusions(id),
    listTags(),
    listStages(),
    getStepLinkBreakdown(id),
    getSequenceLinkRollup(id),
  ]);
  if (!sequence) notFound();

  const [upcomingSteps, dripEnrollments, activity, allContacts] = await Promise.all([
    sequence.type !== "drip"
      ? getUpcomingBroadcastSteps(id, user?.id ?? "", {
          targetTagIds: sequence.target_tag_ids,
          excludeTagIds: sequence.exclude_tag_ids,
          excludeStageIds: sequence.exclude_stage_ids,
          excludeTimelines: sequence.exclude_timelines,
          memberIds: sequence.type === "batch" ? (sequence.snapshot_contact_ids ?? undefined) : undefined,
        })
      : Promise.resolve([]),
    sequence.type === "drip" ? getDripEnrollmentsDetailed(id) : Promise.resolve([]),
    getRecentSequenceActivity(id, 25),
    sequence.type === "drip" ? listContacts({}) : Promise.resolve([]),
  ]);

  const typeLabel = sequence.type === "broadcast" ? "Sequence (Scheduled Date)" : sequence.type === "batch" ? "Batch email" : "Drip";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <Link href="/sequences" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ChevronLeft size={16} /> Campaigns
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900">{sequence.name}</h1>
          {sequence.description && <p className="mt-0.5 text-sm text-neutral-500">{sequence.description}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            {typeLabel}
            {sequence.targetTags.map((t) => (
              <Badge key={t.id} color={t.color}>
                {t.name}
              </Badge>
            ))}
            {!sequence.active && <Badge className="bg-neutral-100 text-neutral-600">Paused</Badge>}
          </p>
          {sequence.type === "drip" && (
            <p className="mt-1 text-xs text-neutral-400">
              {dripEnrollments.filter((e) => e.status === "active").length} actively enrolled
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user && (
            <SequenceSettingsPanel
              sequenceId={sequence.id}
              ownerId={user.id}
              type={sequence.type}
              name={sequence.name}
              description={sequence.description}
              targetTagIds={sequence.target_tag_ids}
              excludeTagIds={sequence.exclude_tag_ids}
              excludeStageIds={sequence.exclude_stage_ids}
              excludeTimelines={sequence.exclude_timelines}
              tags={tags}
              stages={stages}
            />
          )}
          <SequenceToggle sequenceId={sequence.id} active={sequence.active} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Overview</h2>
        <SequenceOverviewStats rollup={rollup} />
      </div>

      {linkRollup.length > 0 && <LinkPerformancePanel links={linkRollup} />}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Steps</h2>
        <StepManager sequenceId={sequence.id} type={sequence.type} steps={steps} stats={stats} linkBreakdown={linkBreakdown} />
      </div>

      {sequence.type !== "drip" ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Upcoming sends</h2>
          <UpcomingBroadcastPanel steps={upcomingSteps} />
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Enrolled contacts</h2>
          <EnrollmentManager
            sequenceId={sequence.id}
            enrollments={dripEnrollments}
            candidateContacts={allContacts.map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email }))}
          />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">Recent activity</h2>
        <RecentActivityFeed items={activity} />
      </div>

      {exclusions.length > 0 && (
        <div id="opt-outs">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Unsubscribed from this sequence</h2>
          <Card className="divide-y divide-neutral-100 p-0">
            {exclusions.map((ex, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-neutral-700">{ex.contacts ? fullName(ex.contacts) : "Unknown"}</span>
                  {ex.unsubscribedFromStep && (
                    <span className="ml-2 text-xs text-neutral-400">after &ldquo;{ex.unsubscribedFromStep}&rdquo;</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-neutral-400">{formatLocal(ex.excluded_at, "MMM d, yyyy")}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
