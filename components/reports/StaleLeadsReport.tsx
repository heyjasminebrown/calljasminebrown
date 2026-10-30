import { StatTile } from "@/components/dashboard/StatTile";
import type { StaleLeadBucket } from "@/lib/data/reports";

export function StaleLeadsReport({ buckets }: { buckets: StaleLeadBucket[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Stale leads</h2>
      <div className="grid grid-cols-3 gap-3">
        {buckets.map((b) => (
          <StatTile key={b.label} label={b.label} value={b.count} tone={b.minDays >= 90 ? "critical" : b.minDays >= 60 ? "warning" : "default"} />
        ))}
      </div>
      <p className="text-xs text-neutral-400">
        Active-stage contacts (not Past Client/Trash/closed) with no logged activity for at least that long, measured
        from their last activity or their lead date if they have none — independent of whether a follow-up date was
        ever set.
      </p>
    </div>
  );
}
