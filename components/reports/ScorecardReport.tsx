import Link from "next/link";
import { cn } from "@/lib/utils";
import { SCORECARD_PERIOD_LABELS, type ScorecardPeriod } from "@/lib/crm/scorecard-period";
import type { MonthlyScorecard, Scorecard } from "@/lib/data/scorecard";
import { TrendLineChart, type TrendPoint } from "@/components/reports/TrendLineChart";

export const REPORT_PERIODS: ScorecardPeriod[] = ["30d", "90d", "year"];

const pct = (r: number | null) => (r == null ? "—" : r > 0 && r < 0.005 ? "<1%" : `${Math.round(r * 100)}%`);

function Stat({ label, value, rate }: { label: string; value: number; rate?: number | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f4f1f5] px-3 py-2.5">
      <p className="truncate text-[12px] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold leading-none text-neutral-900">
        {value}
        {rate !== undefined && <span className="ml-1.5 text-[13px] font-medium text-neutral-500">{pct(rate)}</span>}
      </p>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
        {note && <p className="text-xs text-neutral-400">{note}</p>}
      </div>
      {children}
    </div>
  );
}

// Headline numbers for the chosen period, then a Jan-Dec line per metric.
export function ScorecardReport({
  period,
  current,
  year,
  error,
}: {
  period: ScorecardPeriod;
  current: Scorecard | null;
  year: MonthlyScorecard[] | null;
  error: string | null;
}) {
  const series = (pick: (s: Scorecard) => number): TrendPoint[] =>
    (year ?? []).map((m) => ({ label: m.month, value: m.future ? null : pick(m.scorecard) }));

  return (
    <div className="space-y-5">
      <nav aria-label="Time period" className="flex flex-wrap gap-1.5">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p}
            href={`/reports?scorecard=${p}`}
            scroll={false}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] font-medium",
              p === period ? "border-[#34223a] bg-[#34223a] text-peach" : "border-[#ddd7da] bg-white text-neutral-600 hover:bg-[#f4f1f5]",
            )}
          >
            {SCORECARD_PERIOD_LABELS[p]}
          </Link>
        ))}
      </nav>

      {error || !current || !year ? (
        <p className="text-sm text-red-600">Couldn&apos;t load these numbers: {error ?? "no data"}</p>
      ) : (
        <>
          <Group title="Conversion" note="Counts start from when Types were added. Rate = share of that Type who became a Client.">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="All → Client" value={current.conversion.total} />
              <Stat label="Prospect → Client" value={current.conversion.fromProspect} rate={current.conversion.prospectRate} />
              <Stat label="Community → Client" value={current.conversion.fromCommunity} rate={current.conversion.communityRate} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TrendLineChart title="All → Client" points={series((s) => s.conversion.total)} />
              <TrendLineChart title="Prospect → Client" points={series((s) => s.conversion.fromProspect)} />
              <TrendLineChart title="Community → Client" points={series((s) => s.conversion.fromCommunity)} />
            </div>
          </Group>

          <Group title="Texts" note="Texts sent from the CRM through Quo. Replied = they texted back after your first text.">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="People texted" value={current.texts.texted} />
              <Stat label="Replied" value={current.texts.replied} rate={current.texts.replyRate} />
              <Stat label="Opted out" value={current.texts.optedOut} rate={current.texts.optOutRate} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TrendLineChart title="People texted" points={series((s) => s.texts.texted)} />
              <TrendLineChart title="Replied" points={series((s) => s.texts.replied)} />
              <TrendLineChart title="Opted out" points={series((s) => s.texts.optedOut)} />
            </div>
          </Group>

          <Group title="Campaign emails" note="Emails sent by campaigns. Rates are against emails sent.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Sent" value={current.emails.sent} />
              <Stat label="Opened" value={current.emails.opened} rate={current.emails.openRate} />
              <Stat label="Clicked" value={current.emails.clicked} rate={current.emails.clickRate} />
              <Stat label="Replied" value={current.emails.replied} rate={current.emails.replyRate} />
              <Stat label="Unsubscribed" value={current.emails.unsubscribed} rate={current.emails.unsubscribeRate} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TrendLineChart title="Sent" points={series((s) => s.emails.sent)} />
              <TrendLineChart title="Opened" points={series((s) => s.emails.opened)} />
              <TrendLineChart title="Clicked" points={series((s) => s.emails.clicked)} />
              <TrendLineChart title="Replied" points={series((s) => s.emails.replied)} />
              <TrendLineChart title="Unsubscribed" points={series((s) => s.emails.unsubscribed)} />
            </div>
          </Group>
        </>
      )}
    </div>
  );
}
