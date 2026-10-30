import { Card } from "@/components/ui";
import { StatTile } from "@/components/dashboard/StatTile";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { COUNT_SCOPE } from "@/lib/crm/count-scopes";
import type { LeadSourceReportRow } from "@/lib/data/reports";

export function LeadSourceReport({ rows }: { rows: LeadSourceReportRow[] }) {
  const totalContacts = rows.reduce((s, r) => s + r.contactCount, 0);
  const totalConverted = rows.reduce((s, r) => s + r.convertedCount, 0);
  const totalGross = rows.reduce((s, r) => s + r.grossCommission, 0);
  const overallRate = totalContacts > 0 ? (totalConverted / totalContacts) * 100 : 0;

  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">No contacts yet — this fills in once leads start coming in.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Non-archived contacts" value={totalContacts} />
        <StatTile label="Converted to clients" value={totalConverted} tone="good" />
        <StatTile label="Overall conversion" value={formatPercent(overallRate)} />
        <StatTile label="Gross commission" value={formatCurrency(totalGross)} />
      </div>
      <p className="text-xs text-neutral-400">{COUNT_SCOPE.reports}</p>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">By lead source</h2>

        {/* Mobile: one card per source */}
        <div className="space-y-2.5 md:hidden">
          {rows.map((r) => (
            <SourceCard key={r.source} row={r} maxContacts={rows[0]?.contactCount ?? 1} />
          ))}
        </div>

        {/* Desktop: table - only 6 columns, no horizontal scroll needed */}
        <div className="hidden overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-card md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Contacts</th>
                <th className="px-4 py-2.5 font-medium">Converted</th>
                <th className="px-4 py-2.5 font-medium">Conversion</th>
                <th className="px-4 py-2.5 font-medium">Won deals</th>
                <th className="px-4 py-2.5 font-medium">Gross commission</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{r.source}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{r.contactCount}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{r.convertedCount}</td>
                  <td className="px-4 py-2.5">
                    <ConversionBadge rate={r.conversionRate} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{r.wonDealCount}</td>
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{formatCurrency(r.grossCommission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        Converted = has at least one closed (won) deal. Gross commission is the raw deal amount before KW/KWRI/FMLS/TC
        fees — see the Commissions tab for what actually lands net of those.
      </p>
    </div>
  );
}

function SourceCard({ row, maxContacts }: { row: LeadSourceReportRow; maxContacts: number }) {
  const barPct = maxContacts > 0 ? Math.max((row.contactCount / maxContacts) * 100, 4) : 0;
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-neutral-800">{row.source}</p>
        <ConversionBadge rate={row.conversionRate} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${barPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{row.contactCount} contact{row.contactCount === 1 ? "" : "s"}</span>
        <span>{row.convertedCount} converted</span>
        <span>{row.wonDealCount} won deal{row.wonDealCount === 1 ? "" : "s"}</span>
        <span className="font-medium text-neutral-700">{formatCurrency(row.grossCommission)}</span>
      </div>
    </Card>
  );
}

function ConversionBadge({ rate }: { rate: number }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
        rate >= 20 ? "bg-emerald-50 text-emerald-700" : rate > 0 ? "bg-neutral-100 text-neutral-600" : "bg-neutral-50 text-neutral-400",
      )}
    >
      {formatPercent(rate, 0)}
    </span>
  );
}
