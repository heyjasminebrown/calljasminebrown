import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import type { CommissionTrendMonth } from "@/lib/data/reports";

export function CommissionTrendReport({ months }: { months: CommissionTrendMonth[] }) {
  const maxGross = Math.max(...months.map((m) => m.grossCommission), 1);
  const total = months.reduce((sum, m) => sum + m.grossCommission, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Commission trend (last 6 months)</h2>
        <span className="text-xs text-neutral-400">{formatCurrency(total)} gross total</span>
      </div>
      <Card className="space-y-2.5">
        {months.map((m) => (
          <div key={m.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-neutral-500">{m.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max((m.grossCommission / maxGross) * 100, m.grossCommission > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-medium text-neutral-700">
              {formatCurrency(m.grossCommission)}
            </span>
          </div>
        ))}
      </Card>
      <p className="text-xs text-neutral-400">
        Gross commission (before KW/KWRI/FMLS/TC fees) by month closed — see the Commissions tab for what actually
        lands net of those.
      </p>
    </div>
  );
}
