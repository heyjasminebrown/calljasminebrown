import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/data/metrics";

export function PeriodToggle({ period, basePath = "/" }: { period: Period; basePath?: string }) {
  return (
    <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5 text-xs font-medium">
      {(["week", "month"] as Period[]).map((p) => (
        <Link
          key={p}
          href={`${basePath}?period=${p}`}
          className={cn(
            "rounded-full px-3 py-1.5 capitalize",
            period === p ? "bg-brand-600 text-white" : "text-neutral-500",
          )}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}
