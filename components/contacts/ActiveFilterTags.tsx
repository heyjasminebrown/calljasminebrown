"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { activeFilterTags, removeActiveFilter } from "@/lib/crm/contact-active-filters";
import type { PipelineStage, Tag } from "@/types/database";

export function ActiveFilterTags({ stages, tags }: { stages: PipelineStage[]; tags: Tag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chips = activeFilterTags(searchParams, stages, tags);
  if (chips.length === 0) return null;

  function apply(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply(removeActiveFilter(searchParams, chip.key))}
          className="inline-flex items-center gap-1 rounded-full border border-[#eadfd6] bg-[#fffbf8] py-1 pl-3 pr-2 text-[13px] font-medium text-neutral-700"
        >
          {chip.label}
          <X size={12} className="text-neutral-400" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          const next = new URLSearchParams();
          const list = searchParams.get("list");
          if (list) next.set("list", list);
          apply(next);
        }}
        className="text-[13px] font-medium text-[#c45c4a]"
      >
        Clear all
      </button>
    </div>
  );
}
