"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Folder, Plus, Zap } from "lucide-react";
import { isSmartList, partitionLists, SMART_LIST_VIEW, smartListSearchParamsFromFilters } from "@/lib/crm/smart-lists";
import { cn } from "@/lib/utils";
import type { ContactSegment } from "@/types/database";

export function SmartListsRail({ segments }: { segments: ContactSegment[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { staticLists, smartLists } = partitionLists(segments);
  const activeList = searchParams.get("list");
  const smartView = searchParams.get("view") === SMART_LIST_VIEW || isSmartList(segments.find((s) => s.id === activeList));

  function go(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function openAll() {
    go(new URLSearchParams());
  }

  function openStatic(seg: ContactSegment) {
    const params = new URLSearchParams(seg.filters as Record<string, string>);
    params.set("list", seg.id);
    go(params);
  }

  function openSmart(seg: ContactSegment) {
    const params = smartListSearchParamsFromFilters(seg.filters);
    params.set("list", seg.id);
    go(params);
  }

  function openNewSmart() {
    const params = new URLSearchParams();
    params.set("view", SMART_LIST_VIEW);
    go(params);
  }

  return (
    <aside className="hidden w-[220px] shrink-0 self-start lg:block">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[.08em] text-neutral-400">Lists</p>

      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">
        <Folder size={12} /> Static lists
      </p>
      <div className="mb-4 space-y-0.5">
        <RailButton active={!activeList && !smartView} onClick={openAll}>
          All contacts
        </RailButton>
        {staticLists.map((seg) => (
          <RailButton key={seg.id} active={activeList === seg.id && !smartView} onClick={() => openStatic(seg)}>
            {seg.name}
          </RailButton>
        ))}
      </div>

      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">
        <Zap size={12} className="text-[#c45c4a]" /> Smart lists
      </p>
      <div className="space-y-0.5">
        <RailButton active={smartView && !activeList} onClick={openNewSmart} icon={<Plus size={13} />}>
          New smart list
        </RailButton>
        {smartLists.map((seg) => (
          <RailButton
            key={seg.id}
            active={activeList === seg.id}
            onClick={() => openSmart(seg)}
            icon={<Zap size={13} className="text-[#c45c4a]" />}
          >
            {seg.name}
          </RailButton>
        ))}
      </div>
    </aside>
  );
}

function RailButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium",
        active ? "bg-[#f3e4dc] text-[#c45c4a]" : "text-neutral-600 hover:bg-[#fff7f1] hover:text-neutral-900",
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
