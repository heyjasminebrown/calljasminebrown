import { Card } from "@/components/ui";
import { formatPercent } from "@/lib/utils";
import type { CommissionRateTrendMonth } from "@/lib/data/reports";

export function CommissionRateTrendReport({ months }: { months: CommissionRateTrendMonth[] }) {
  const maxRate = Math.max(...months.map((m) => m.avgRate ?? 0), 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Average commission rate (last 6 months)</h2>
      <Card className="space-y-2.5">
        {months.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-neutral-500">{m.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${m.avgRate != null ? Math.max((m.avgRate / maxRate) * 100, 4) : 0}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-medium text-neutral-700">
              {m.avgRate != null ? formatPercent(m.avgRate, 2) : "—"}
            </span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-neutral-400">Average of (gross commission ÷ sale price) across deals closed that month.</p>
    </div>
  );
}
