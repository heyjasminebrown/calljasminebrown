import { Card } from "@/components/ui";
import type { TaskTrendMonth } from "@/lib/data/reports";

export function TaskCompletionTrendReport({ months }: { months: TaskTrendMonth[] }) {
  const maxCount = Math.max(...months.flatMap((m) => [m.created, m.completed]), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Task completion trend</h2>
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-300" /> Created
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Completed
          </span>
        </div>
      </div>
      <Card className="space-y-3">
        {months.map((m) => (
          <div key={m.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{m.label}</span>
              <span>
                {m.completed} of {m.created}
              </span>
            </div>
            <div className="flex h-3 gap-0.5">
              <div className="flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-neutral-300" style={{ width: `${Math.max((m.created / maxCount) * 100, m.created > 0 ? 4 : 0)}%` }} />
              </div>
              <div className="flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((m.completed / maxCount) * 100, m.completed > 0 ? 4 : 0)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
