import { Card } from "@/components/ui";
import type { TagSegmentData } from "@/lib/data/reports";

export function TagSegmentsReport({ data }: { data: TagSegmentData }) {
  const maxCount = Math.max(...data.rows.map((r) => r.count), data.untaggedCount, 1);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Contacts by tag</h2>
      <Card className="space-y-2.5">
        {data.rows.map((r) => (
          <div key={r.tagName} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-neutral-500">{r.tagName}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max((r.count / maxCount) * 100, 4)}%`, backgroundColor: r.color }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-neutral-700">{r.count}</span>
          </div>
        ))}
        {data.untaggedCount > 0 && (
          <div className="flex items-center gap-3 border-t border-neutral-100 pt-2.5">
            <span className="w-32 shrink-0 text-xs text-neutral-400">Untagged</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-neutral-300" style={{ width: `${Math.max((data.untaggedCount / maxCount) * 100, 4)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-neutral-500">{data.untaggedCount}</span>
          </div>
        )}
      </Card>
      <p className="text-xs text-neutral-400">A contact can carry more than one tag, so counts here can add up to more than your total contact count.</p>
    </div>
  );
}
