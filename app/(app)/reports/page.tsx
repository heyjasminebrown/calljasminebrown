import {
  getLeadSourceReport,
  getNewLeadsReport,
  getContactTypeBreakdown,
  getSourceTrend,
  getTagSegments,
  getJourneyStageBreakdown,
  getStageDistribution,
  getStaleLeadsReport,
  getDuplicateRiskPairs,
  getSpeedToLeadDistribution,
  getFollowUpRateTrend,
  getLeadEngagementBreakdown,
  getSequenceEngagementReport,
  getTaskCompletionTrend,
  getCommissionTrend,
  getCommissionRateTrend,
  getDealForecast,
} from "@/lib/data/reports";
import Link from "next/link";
import { getMetrics } from "@/lib/data/metrics";
import { formatCurrency } from "@/lib/utils";
import { Section } from "@/components/ui/Section";
import { QuestionExtras } from "@/components/reports/QuestionExtras";
import { LeadSourceReport } from "@/components/reports/LeadSourceReport";
import { NewLeadsReport } from "@/components/reports/NewLeadsReport";
import { ContactMixReport } from "@/components/reports/ContactMixReport";
import { SourceTrendReport } from "@/components/reports/SourceTrendReport";
import { TagSegmentsReport } from "@/components/reports/TagSegmentsReport";
import { JourneyStageReport } from "@/components/reports/JourneyStageReport";
import { StageDistributionReport } from "@/components/reports/StageDistributionReport";
import { StaleLeadsReport } from "@/components/reports/StaleLeadsReport";
import { DuplicateRiskReport } from "@/components/reports/DuplicateRiskReport";
import { SpeedToLeadReport } from "@/components/reports/SpeedToLeadReport";
import { FollowUpRateTrendReport } from "@/components/reports/FollowUpRateTrendReport";
import { LeadEngagementReport } from "@/components/reports/LeadEngagementReport";
import { SequenceEngagementReport } from "@/components/reports/SequenceEngagementReport";
import { TaskCompletionTrendReport } from "@/components/reports/TaskCompletionTrendReport";
import { CommissionTrendReport } from "@/components/reports/CommissionTrendReport";
import { CommissionRateTrendReport } from "@/components/reports/CommissionRateTrendReport";
import { DealForecastReport } from "@/components/reports/DealForecastReport";
import { CountScopeNote } from "@/components/CountScopeNote";
import type { Period } from "@/lib/data/metrics";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams;
  const period: Period = params.period === "month" ? "month" : "week";

  const [
    leadSourceRows,
    newLeads,
    newLeadsMonth,
    contactMix,
    sourceTrend,
    tagSegments,
    journeyStage,
    stageDistribution,
    staleLeads,
    duplicatePairs,
    speedToLead,
    followUpTrend,
    leadEngagement,
    sequenceEngagement,
    taskTrend,
    commissionTrend,
    commissionRateTrend,
    dealForecast,
    metrics,
  ] = await Promise.all([
    getLeadSourceReport(),
    getNewLeadsReport(period),
    getNewLeadsReport("month"),
    getContactTypeBreakdown(),
    getSourceTrend(),
    getTagSegments(),
    getJourneyStageBreakdown(),
    getStageDistribution(),
    getStaleLeadsReport(),
    getDuplicateRiskPairs(),
    getSpeedToLeadDistribution(period),
    getFollowUpRateTrend(),
    getLeadEngagementBreakdown(),
    getSequenceEngagementReport(),
    getTaskCompletionTrend(),
    getCommissionTrend(),
    getCommissionRateTrend(),
    getDealForecast(),
    getMetrics("month"),
  ]);

  const topSource = [...leadSourceRows].sort((a, b) => b.contactCount - a.contactCount)[0] ?? null;
  const speedToLeadHours = metrics.speedToLead.current;
  const forecastTotal = dealForecast.months.reduce((sum, m) => sum + m.grossCommission, 0) + dealForecast.otherGrossCommission;

  const summaryLines = [
    `${newLeadsMonth.total} new leads this month${topSource ? `, most from ${topSource.source}` : ""}.`,
    speedToLeadHours != null
      ? `You're averaging a ${speedToLeadHours < 1 ? `${Math.round(speedToLeadHours * 60)}-minute` : `${speedToLeadHours.toFixed(1)}-hour`} speed to lead this month.`
      : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-[28px]">Reports</h1>
      <p className="mt-1 text-[15px] text-neutral-500">
        Where your leads actually come from, which sources turn into closed business, and what&apos;s coming next.
      </p>
      <CountScopeNote current="reports" />

      <div className="mt-5 rounded-2xl border border-[#ebe9e7] bg-white p-[18px]">
        <p className="text-sm font-semibold text-neutral-500">Worth knowing this month</p>
        {summaryLines.map((line) => (
          <p key={line} className="mt-1.5 text-[15px] leading-6 text-neutral-700">
            {line}
          </p>
        ))}
        <Link href="/contacts?newSince=30&sort=lead_date_desc" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          Text those {newLeadsMonth.total} →
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        <Section sectionKey="reports:leads" title="Where are my leads coming from?" meta={topSource ? `Mostly ${topSource.source}` : undefined} defaultOpen={false}>
          <div className="p-[18px]">
            <LeadSourceReport rows={leadSourceRows} />
            <QuestionExtras
              items={[
                { key: "sourceTrend", label: "Source trend", content: <SourceTrendReport data={sourceTrend} /> },
                { key: "tagSegments", label: "Tag segments", content: <TagSegmentsReport data={tagSegments} /> },
                { key: "contactMix", label: "Contact mix", content: <ContactMixReport rows={contactMix} /> },
                { key: "journeyStage", label: "Journey stage", content: <JourneyStageReport rows={journeyStage} /> },
                { key: "newLeads", label: "New leads by source", content: <NewLeadsReport data={newLeads} period={period} /> },
              ]}
            />
          </div>
        </Section>

        <Section
          sectionKey="reports:followup"
          title="Am I following up fast enough?"
          meta={speedToLeadHours != null ? `${speedToLeadHours.toFixed(1)}h median` : undefined}
          defaultOpen={false}
        >
          <div className="p-[18px]">
            <SpeedToLeadReport buckets={speedToLead} period={period} />
            <QuestionExtras
              items={[
                { key: "followUpTrend", label: "Follow-up rate trend", content: <FollowUpRateTrendReport months={followUpTrend} /> },
                { key: "leadEngagement", label: "Lead engagement", content: <LeadEngagementReport buckets={leadEngagement} /> },
                { key: "stageDistribution", label: "Stage distribution", content: <StageDistributionReport rows={stageDistribution} /> },
                { key: "taskTrend", label: "Task completion trend", content: <TaskCompletionTrendReport months={taskTrend} /> },
                { key: "staleLeads", label: "Stale leads", content: <StaleLeadsReport buckets={staleLeads} /> },
                { key: "duplicateRisk", label: "Duplicate risk", content: <DuplicateRiskReport pairs={duplicatePairs} /> },
                { key: "sequences", label: "Sequence engagement", content: <SequenceEngagementReport rows={sequenceEngagement} /> },
              ]}
            />
          </div>
        </Section>

        <Section sectionKey="reports:money" title="What am I on track to earn?" meta={`${formatCurrency(forecastTotal)} forecast`} defaultOpen={false}>
          <div className="p-[18px]">
            <CommissionTrendReport months={commissionTrend} />
            <QuestionExtras
              items={[
                { key: "dealForecast", label: "Deal forecast", content: <DealForecastReport data={dealForecast} /> },
                { key: "commissionRate", label: "Commission rate trend", content: <CommissionRateTrendReport months={commissionRateTrend} /> },
              ]}
            />
          </div>
        </Section>
      </div>

      <p className="mt-5 text-sm text-neutral-400">
        Each report is a link inside the question it answers, rather than a chart on a wall of charts.
      </p>
    </div>
  );
}
