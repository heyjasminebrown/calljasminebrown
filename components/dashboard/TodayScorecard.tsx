import Link from "next/link";
import { Mail, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";
import { SCORECARD_PERIOD_LABELS, type ScorecardPeriod } from "@/lib/crm/scorecard-period";
import type { Scorecard } from "@/lib/data/scorecard";

export const TODAY_PERIODS: ScorecardPeriod[] = ["7d", "30d", "this_month", "last_month"];

export type ScorecardResult = { period: ScorecardPeriod; data: Scorecard | null; error: string | null };

function pct(r: number | null): string {
  if (r == null) return "—";
  return r > 0 && r < 0.005 ? "<1%" : `${Math.round(r * 100)}%`;
}

export function TodayPeriodSwitcher({ period }: { period: ScorecardPeriod }) {
  return (
    <nav aria-label="Time period" className="flex flex-wrap gap-1.5">
      {TODAY_PERIODS.map((p) => (
        <Link
          key={p}
          href={`/?period=${p}`}
          scroll={false}
          aria-current={p === period ? "page" : undefined}
          className={cn(
            "rounded-full border px-3 py-1 text-[13px] font-medium",
            p === period ? "border-[#34223a] bg-[#34223a] text-peach" : "border-[#ddd7da] bg-[#fcfbfb] text-neutral-600 hover:bg-[#f4f1f5]",
          )}
        >
          {SCORECARD_PERIOD_LABELS[p]}
        </Link>
      ))}
    </nav>
  );
}

function CardShell({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("h-full min-w-0 overflow-hidden p-4 sm:p-5", TODAY_CARD, className)}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-800">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

function ScorecardError({ error }: { error: string }) {
  return <p className="mt-3 text-[13px] text-red-600">Couldn&apos;t load these numbers: {error}</p>;
}

export function TodayConversionCard({ result }: { result: ScorecardResult }) {
  const c = result.data?.conversion;
  return (
    <CardShell icon={<TrendingUp size={16} strokeWidth={1.7} className="text-[#34223a]" />} title="Conversion">
      {result.error || !c ? (
        <ScorecardError error={result.error ?? "no data"} />
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="font-serif text-[32px] font-semibold leading-none text-neutral-900">{c.total}</p>
            <p className="text-[14px] text-neutral-500">became {c.total === 1 ? "a client" : "clients"}</p>
          </div>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            <ConversionRow label="Prospect → Client" count={c.fromProspect} rate={c.prospectRate} />
            <ConversionRow label="Community → Client" count={c.fromCommunity} rate={c.communityRate} />
          </ul>
          <p className="mt-3 text-[12px] text-neutral-400">
            Rate = share of that Type who became a Client. Counts start from when Types were added.
          </p>
        </>
      )}
    </CardShell>
  );
}

function ConversionRow({ label, count, rate }: { label: string; count: number; rate: number | null }) {
  return (
    <li className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-neutral-600">{label}</span>
      <span className="shrink-0 font-semibold text-neutral-800">{count}</span>
      <span className="w-12 shrink-0 text-right text-neutral-500">{pct(rate)}</span>
    </li>
  );
}

// A funnel row: the count, and its rate against the first step.
function FunnelStep({ label, count, rate, warn }: { label: string; count: number; rate?: number | null; warn?: boolean }) {
  return (
    <li className="flex items-center gap-3 text-[14px]">
      <span className="min-w-0 flex-1 truncate text-neutral-600">{label}</span>
      <span className="shrink-0 font-semibold text-neutral-800">{count}</span>
      <span className={cn("w-12 shrink-0 text-right", warn ? "font-medium text-amber-700" : "text-neutral-500")}>
        {rate === undefined ? "" : pct(rate)}
      </span>
    </li>
  );
}

export function TodayOutreachCard({ result }: { result: ScorecardResult }) {
  const t = result.data?.texts;
  const e = result.data?.emails;
  return (
    <CardShell icon={<MessageSquare size={16} strokeWidth={1.7} className="text-[#34223a]" />} title="Outreach">
      {result.error || !t || !e ? (
        <ScorecardError error={result.error ?? "no data"} />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              <MessageSquare size={13} /> Texts
            </p>
            <ul className="mt-2 space-y-2">
              <FunnelStep label="People texted" count={t.texted} />
              <FunnelStep label="Replied" count={t.replied} rate={t.replyRate} />
              {/* Over ~2% opt-outs is worth watching: carriers can flag the number. */}
              <FunnelStep label="Opted out" count={t.optedOut} rate={t.optOutRate} warn={(t.optOutRate ?? 0) > 0.02} />
            </ul>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
              <Mail size={13} /> Campaign emails
            </p>
            <ul className="mt-2 space-y-2">
              <FunnelStep label="Sent" count={e.sent} />
              <FunnelStep label="Opened" count={e.opened} rate={e.openRate} />
              <FunnelStep label="Clicked" count={e.clicked} rate={e.clickRate} />
              <FunnelStep label="Replied" count={e.replied} rate={e.replyRate} />
              <FunnelStep label="Unsubscribed" count={e.unsubscribed} rate={e.unsubscribeRate} warn={(e.unsubscribeRate ?? 0) > 0.02} />
            </ul>
          </div>
        </div>
      )}
    </CardShell>
  );
}
