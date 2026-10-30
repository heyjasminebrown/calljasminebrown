import Link from "next/link";
import { Card } from "@/components/ui";
import type { DuplicateRiskPair } from "@/lib/data/reports";

export function DuplicateRiskReport({ pairs }: { pairs: DuplicateRiskPair[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">Possible duplicates</h2>
      {pairs.length === 0 ? (
        <p className="text-sm text-neutral-500">No exact email/phone matches found across your contacts.</p>
      ) : (
        <Card className="space-y-2.5">
          {pairs.map((p) => (
            <div key={`${p.aId}:${p.bId}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-50 pb-2.5 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <Link href={`/contacts/${p.aId}`} target="_blank" className="font-medium text-neutral-800 hover:underline">
                  {p.aName || "Unnamed"}
                </Link>
                <span className="text-neutral-400">and</span>
                <Link href={`/contacts/${p.bId}`} target="_blank" className="font-medium text-neutral-800 hover:underline">
                  {p.bName || "Unnamed"}
                </Link>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Same {p.matchedOn}
              </span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-neutral-400">Open either contact and use Merge to combine them if they&apos;re the same person.</p>
    </div>
  );
}
