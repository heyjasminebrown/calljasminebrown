import { Card } from "@/components/ui";
import type { ContactTypeBreakdownRow } from "@/lib/data/reports";

export function ContactMixReport({ rows }: { rows: ContactTypeBreakdownRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">Contact mix</h2>
        <span className="text-xs text-neutral-400">{total} non-archived (every type — not the Contacts filtered list)</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No contacts yet.</p>
      ) : (
        <Card className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.type} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-xs text-neutral-500">{r.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((r.count / maxCount) * 100, 4)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-medium text-neutral-700">
                {r.count} ({total > 0 ? Math.round((r.count / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
