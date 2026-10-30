import { Card } from "@/components/ui";
import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import type { SpeedToLeadBucket } from "@/lib/data/reports";
import type { Period } from "@/lib/data/metrics";
import { cn } from "@/lib/utils";

export function SpeedToLeadReport({ buckets, period }: { buckets: SpeedToLeadBucket[]; period: Period }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div id="speed-to-lead" className="space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Speed to lead distribution</h2>
        <PeriodToggle period={period} basePath="/reports" />
      </div>
      {total === 0 ? (
        <p className="text-sm text-neutral-500">No new leads in this period.</p>
      ) : (
        <Card className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-xs text-neutral-500">{b.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn("h-full rounded-full", b.label === "Never contacted" ? "bg-red-400" : "bg-brand-500")}
                  style={{ width: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs font-medium text-neutral-700">
                {b.count} ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-neutral-400">
        Same underlying numbers as the Accountability &ldquo;Speed to lead&rdquo; average on the Dashboard — this just
        shows the spread instead of a single average, since one slow outlier can hide how most leads are actually
        handled.
      </p>
    </div>
  );
}
