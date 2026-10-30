import { Card } from "@/components/ui";
import type { SourceTrendData } from "@/lib/data/reports";

export function SourceTrendReport({ data }: { data: SourceTrendData }) {
  if (data.rows.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-700">Lead source trend (last 6 months)</h2>
        <p className="text-sm text-neutral-500">No leads in the last 6 months yet.</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.rows.flatMap((r) => r.monthlyCounts), 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Lead source trend (last 6 months)</h2>

      {/* Mobile: one card per source, mini bar-per-month sparkline */}
      <div className="space-y-2.5 md:hidden">
        {data.rows.map((r) => (
          <Card key={r.source} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-800">{r.source}</p>
              <span className="text-xs text-neutral-500">{r.total} total</span>
            </div>
            <div className="flex items-end gap-1">
              {r.monthlyCounts.map((count, i) => (
                <div key={data.monthLabels[i]} className="flex-1 space-y-1 text-center">
                  <div className="flex h-10 items-end overflow-hidden rounded bg-neutral-100">
                    <div
                      className="w-full rounded bg-brand-500"
                      style={{ height: `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400">{count}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: table, one row per source, one column per month */}
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Source</th>
              {data.monthLabels.map((label) => (
                <th key={label} className="px-4 py-2.5 text-right font-medium">
                  {label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.source} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-2.5 font-medium text-neutral-800">{r.source}</td>
                {r.monthlyCounts.map((count, i) => (
                  <td key={data.monthLabels[i]} className="px-4 py-2.5 text-right text-neutral-600">
                    {count}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-medium text-neutral-800">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
