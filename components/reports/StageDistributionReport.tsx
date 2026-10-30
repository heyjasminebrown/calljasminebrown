import { Card } from "@/components/ui";
import type { StageDistributionRow } from "@/lib/data/reports";

export function StageDistributionReport({ rows }: { rows: StageDistributionRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Contacts by stage</h2>
        <span className="text-xs text-neutral-400">{total} non-archived (all stages, including closed — not Pipeline active-only)</span>
      </div>
      <Card className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.stageName} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-neutral-500">{r.stageName}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max((r.count / maxCount) * 100, r.count > 0 ? 4 : 0)}%`, backgroundColor: r.color }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-neutral-700">{r.count}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
