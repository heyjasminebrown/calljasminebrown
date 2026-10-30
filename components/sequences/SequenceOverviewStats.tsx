import { StatTile } from "@/components/dashboard/StatTile";
import { RateBar } from "@/components/sequences/RateBar";
import { Card } from "@/components/ui";
import type { SequenceRollup } from "@/lib/data/sequences";

export function SequenceOverviewStats({ rollup }: { rollup: SequenceRollup }) {
  if (rollup.totalSent === 0) {
    return (
      <Card className="text-sm text-neutral-500">
        No emails sent from this sequence yet — stats will show up here once the first step goes out.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Sent" value={rollup.totalSent} />
        <StatTile label="Open rate" value={`${rollup.openRate.toFixed(0)}%`} tone="good" />
        <StatTile label="Click rate" value={`${rollup.clickRate.toFixed(0)}%`} />
        <StatTile
          label="Unsubscribed"
          value={`${rollup.unsubRate.toFixed(0)}%`}
          tone={rollup.unsubRate > 5 ? "warning" : "default"}
        />
      </div>
      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RateBar label="Opened (of sent)" count={rollup.totalOpened} total={rollup.totalSent} color="bg-brand-500" />
        <RateBar label="Clicked (of sent)" count={rollup.totalClicked} total={rollup.totalSent} color="bg-emerald-500" />
        <RateBar label="Click-to-open" count={rollup.totalClicked} total={rollup.totalOpened} color="bg-amber-500" />
      </Card>
      {(rollup.bestStep || rollup.worstStep) && (
        <Card className="space-y-1.5 text-sm">
          {rollup.bestStep && (
            <p className="text-neutral-600">
              <span className="font-medium text-emerald-600">Best opening:</span> &ldquo;{rollup.bestStep.subject}&rdquo; at{" "}
              {rollup.bestStep.openRate.toFixed(0)}%
            </p>
          )}
          {rollup.worstStep && (
            <p className="text-neutral-600">
              <span className="font-medium text-amber-600">Lowest opening:</span> &ldquo;{rollup.worstStep.subject}&rdquo; at{" "}
              {rollup.worstStep.openRate.toFixed(0)}%
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
