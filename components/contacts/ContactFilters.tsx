"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition, useEffect, useRef, type ReactNode } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHEET_PARAM_KEYS } from "@/lib/crm/contact-filter-params";
import { ActiveFilterTags } from "@/components/contacts/ActiveFilterTags";
import { ContactFiltersSheet } from "@/components/contacts/ContactFiltersSheet";
import type { PipelineStage, Tag } from "@/types/database";

// Shared with PeopleMobile's sort control, so the phone view can offer the
// exact same options (including "Likelihood (hot first)," which used to
// only exist on desktop even though listContacts already computes it) -
// one list, not two that could drift.
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Recently added" },
  { value: "created_asc", label: "Oldest added" },
  { value: "lead_date_desc", label: "Lead date (newest)" },
  { value: "lead_date_asc", label: "Lead date (oldest)" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "follow_up_asc", label: "Follow-up date" },
  { value: "likelihood_desc", label: "Likelihood (hot first)" },
  { value: "tag_asc", label: "Tag (A-Z)" },
];

// Params the Filters sheet/panel owns. Re-exported so existing imports keep working.
export { SHEET_PARAM_KEYS };

export function ContactFilters({
  stages,
  tags,
  leadSources,
  eventNames,
  registeredEventNames,
  selectSlot,
  panel = false,
  compact = false,
  filtersOpen,
  onFiltersOpenChange,
}: {
  stages: PipelineStage[];
  tags: Tag[];
  leadSources: string[];
  eventNames: string[];
  registeredEventNames: string[];
  selectSlot?: ReactNode;
  panel?: boolean;
  compact?: boolean;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [internalOpen, setInternalOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetOpen = filtersOpen ?? internalOpen;
  const setSheetOpen = onFiltersOpenChange ?? setInternalOpen;

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const activeFilterCount = SHEET_PARAM_KEYS.filter((k) => {
    const raw = searchParams.get(k);
    if (!raw) return false;
    if (k === "group" && raw === "none") return false;
    if (k === "archived" && raw === "active") return false;
    return true;
  }).length;
  const currentSort = SORT_OPTIONS.find((o) => o.value === (searchParams.get("sort") ?? "updated_desc"));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {!compact && (
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-[13px] top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => updateParam("q", value.trim()), 300);
            }}
            placeholder="Search name, email, phone"
            className="w-full rounded-[11px] border border-neutral-200 bg-white py-3 pl-10 pr-3 text-[15px] text-neutral-900"
          />
        </div>
        )}
        <button
          type="button"
          onClick={() => setSheetOpen(!sheetOpen)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-[11px] border px-3.5 py-3 text-[15px] font-medium",
            sheetOpen || activeFilterCount > 0 ? "border-brand-500 bg-brand-50 text-brand-700" : "border-neutral-200 bg-white text-neutral-800",
          )}
        >
          <SlidersHorizontal size={16} className="text-neutral-500" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        {!compact && selectSlot}
        {!panel && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-2 rounded-[11px] border border-neutral-200 bg-white px-3.5 py-3 text-[15px] font-medium text-neutral-800"
            >
              {currentSort?.label ?? "Recent"} <ChevronDown size={15} className="text-neutral-400" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      updateParam("sort", o.value);
                      setSortOpen(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ActiveFilterTags stages={stages} tags={tags} />

      {sheetOpen && !panel && (
        <ContactFiltersSheet
          stages={stages}
          tags={tags}
          leadSources={leadSources}
          eventNames={eventNames}
          registeredEventNames={registeredEventNames}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
