import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { DealForecastData } from "@/lib/data/reports";

export function DealForecastReport({ data }: { data: DealForecastData }) {
  const maxGross = Math.max(...data.months.map((m) => m.grossCommission), data.otherGrossCommission, 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Deal forecast (pending, by expected close)</h2>
      <Card className="space-y-2.5">
        {data.months.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-neutral-500">{m.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max((m.grossCommission / maxGross) * 100, m.grossCommission > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-xs font-medium text-neutral-700">
              {formatCurrency(m.grossCommission)} · {m.dealCount}
            </span>
          </div>
        ))}
        {data.otherCount > 0 && (
          <div className="flex items-center gap-3 border-t border-neutral-100 pt-2.5">
            <span className="w-16 shrink-0 text-xs text-neutral-400">Other</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-300"
                style={{ width: `${Math.max((data.otherGrossCommission / maxGross) * 100, 4)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-xs font-medium text-neutral-500">
              {formatCurrency(data.otherGrossCommission)} · {data.otherCount}
            </span>
          </div>
        )}
      </Card>
      <p className="text-xs text-neutral-400">
        Gross commission on deals still marked &ldquo;pending,&rdquo; grouped by expected closing date. &ldquo;Other&rdquo;
        is anything past-due or more than 6 months out.
      </p>
    </div>
  );
}
