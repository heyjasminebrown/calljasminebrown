import { Card } from "@/components/ui";
import type { JourneyStageRow } from "@/lib/data/reports";

export function JourneyStageReport({ rows }: { rows: JourneyStageRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">House hacking journey stage</h2>
        <span className="text-xs text-neutral-400">{total} answered</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-neutral-500">No one has answered the journey-stage question yet.</p>
      ) : (
        <Card className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-48 shrink-0 text-xs text-neutral-500">{r.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((r.count / maxCount) * 100, r.count > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-neutral-700">{r.count}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
