import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { inboxHref } from "@/lib/crm/inbox-href";

const FILTERS: { key: "owed" | "all" | "calls"; label: string }[] = [
  { key: "owed", label: "Needs a reply" },
  { key: "all", label: "All threads" },
  { key: "calls", label: "Calls only" },
];

export function MessageFilters({
  activeFilter,
  owedCount,
  spamCount,
}: {
  activeFilter: "owed" | "all" | "calls";
  owedCount: number;
  spamCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 pb-4">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={inboxHref({ filter: f.key })}
          className={cn(
            "whitespace-nowrap rounded-[10px] px-3.5 py-2 text-sm font-medium",
            activeFilter === f.key ? "bg-neutral-900 font-semibold text-white" : "border border-neutral-200 bg-white text-neutral-600",
          )}
        >
          {f.label}
          {f.key === "owed" && ` · ${owedCount}`}
        </Link>
      ))}
      <Link
        href={inboxHref({ spam: true })}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-600"
      >
        <ShieldAlert size={14} className="text-neutral-400" /> Spam <span className="text-neutral-400">{spamCount}</span>
      </Link>
      <Link
        href={inboxHref({ hidden: true })}
        className="whitespace-nowrap rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-600"
      >
        Hidden
      </Link>
    </div>
  );
}
