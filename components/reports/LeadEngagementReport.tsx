import { Card } from "@/components/ui";
import type { EngagementBucket } from "@/lib/data/reports";

export function LeadEngagementReport({ buckets }: { buckets: EngagementBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Email engagement</h2>
      {total === 0 ? (
        <p className="text-sm text-neutral-500">No sequence emails have sent yet.</p>
      ) : (
        <Card className="space-y-2.5">
          {buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs text-neutral-500">{b.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${b.label === "Never opened" ? "bg-neutral-300" : "bg-brand-500"}`}
                  style={{ width: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-medium text-neutral-700">
                {b.count} ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-neutral-400">Across every contact who&apos;s ever received a sequence email, all-time — who&apos;s actually engaging vs. gone quiet.</p>
    </div>
  );
}
