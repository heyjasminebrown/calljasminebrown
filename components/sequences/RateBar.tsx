import { cn } from "@/lib/utils";

export function RateBar({
  label,
  count,
  total,
  color = "bg-brand-500",
}: {
  label: string;
  count: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.min((count / total) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium text-neutral-700">{total > 0 ? `${pct.toFixed(0)}%` : "—"}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-neutral-400">
        {count} of {total}
      </p>
    </div>
  );
}
