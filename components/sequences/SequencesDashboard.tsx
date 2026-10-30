import { StatTile } from "@/components/dashboard/StatTile";
import type { SequencesSummary } from "@/lib/data/sequences";

export function SequencesDashboard({ summary }: { summary: SequencesSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="Active campaigns" value={`${summary.activeCount} / ${summary.totalCount}`} />
      <StatTile label="Currently enrolled" value={summary.totalEnrolled} />
      <StatTile label="Sent (last 30 days)" value={summary.sentLast30Days} />
      <StatTile
        label="Open rate (last 30 days)"
        value={summary.sentLast30Days > 0 ? `${summary.openRateLast30Days.toFixed(0)}%` : "—"}
        tone="good"
      />
    </div>
  );
}
