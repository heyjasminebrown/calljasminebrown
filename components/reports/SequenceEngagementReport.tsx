import { Card } from "@/components/ui";
import { formatPercent } from "@/lib/utils";
import type { SequenceEngagementRow } from "@/lib/data/reports";

export function SequenceEngagementReport({ rows }: { rows: SequenceEngagementRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-700">Sequence engagement</h2>
        <p className="text-sm text-neutral-500">No sequence emails have sent yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Sequence engagement</h2>

      <div className="space-y-2.5 md:hidden">
        {rows.map((r) => (
          <Card key={r.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-800">{r.name}</p>
              <span className="text-xs text-neutral-500">{r.sentTotal} sent</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span>Open {formatPercent(r.openRate, 0)}</span>
              <span>Click {formatPercent(r.clickRate, 0)}</span>
              <span className={r.unsubRate > 5 ? "text-red-600" : ""}>Unsub {formatPercent(r.unsubRate, 1)}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className="px-4 py-2.5 font-medium">Sequence</th>
              <th className="px-4 py-2.5 text-right font-medium">Sent</th>
              <th className="px-4 py-2.5 text-right font-medium">Open rate</th>
              <th className="px-4 py-2.5 text-right font-medium">Click rate</th>
              <th className="px-4 py-2.5 text-right font-medium">Unsub rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-2.5 font-medium text-neutral-800">{r.name}</td>
                <td className="px-4 py-2.5 text-right text-neutral-600">{r.sentTotal}</td>
                <td className="px-4 py-2.5 text-right text-neutral-600">{formatPercent(r.openRate, 0)}</td>
                <td className="px-4 py-2.5 text-right text-neutral-600">{formatPercent(r.clickRate, 0)}</td>
                <td className={`px-4 py-2.5 text-right ${r.unsubRate > 5 ? "font-medium text-red-600" : "text-neutral-600"}`}>
                  {formatPercent(r.unsubRate, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
