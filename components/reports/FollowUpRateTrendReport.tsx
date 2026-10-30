import { Card } from "@/components/ui";
import { formatPercent } from "@/lib/utils";
import type { FollowUpRateTrendMonth } from "@/lib/data/reports";

export function FollowUpRateTrendReport({ months }: { months: FollowUpRateTrendMonth[] }) {
  const maxRate = Math.max(...months.map((m) => m.rate ?? 0), 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Follow-up rate trend</h2>
      <Card className="space-y-2.5">
        {months.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-neutral-500">{m.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${m.rate != null ? Math.max((m.rate / maxRate) * 100, 4) : 0}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-xs font-medium text-neutral-700">{m.rate != null ? formatPercent(m.rate, 0) : "—"}</span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-neutral-400">% of tasks due that month that were actually completed.</p>
    </div>
  );
}
