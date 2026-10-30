import { Card } from "@/components/ui";
import { StatTile } from "@/components/dashboard/StatTile";
import { PeriodToggle } from "@/components/dashboard/PeriodToggle";
import type { NewLeadsReportData } from "@/lib/data/reports";
import type { Period } from "@/lib/data/metrics";

export function NewLeadsReport({ data, period }: { data: NewLeadsReportData; period: Period }) {
  const maxCount = data.bySource[0]?.count ?? 1;

  return (
    <div id="new-leads" className="space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">New leads</h2>
        <PeriodToggle period={period} basePath="/reports" />
      </div>

      <StatTile label={period === "week" ? "New leads this week" : "New leads this month"} value={data.total} tone="warning" />

      {data.bySource.length === 0 ? (
        <p className="text-sm text-neutral-500">No new leads in this period.</p>
      ) : (
        <Card className="space-y-2.5">
          {data.bySource.map((row) => (
            <div key={row.source} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-800">{row.source}</span>
                <span className="text-neutral-500">
                  {row.count} lead{row.count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max((row.count / maxCount) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
