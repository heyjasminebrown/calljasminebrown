import { Card } from "@/components/ui";
import { shortenUrl } from "@/lib/utils";

export function LinkPerformancePanel({ links }: { links: { url: string; count: number }[] }) {
  if (links.length === 0) return null;
  const max = Math.max(...links.map((l) => l.count));

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-neutral-700">Link performance (all-time)</h3>
      <div className="space-y-2.5">
        {links.map((l) => (
          <div key={l.url}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-brand-600 hover:underline"
              >
                {shortenUrl(l.url)}
              </a>
              <span className="shrink-0 font-medium text-neutral-700">
                {l.count} click{l.count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(l.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
