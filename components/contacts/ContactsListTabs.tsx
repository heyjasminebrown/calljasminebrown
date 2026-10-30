"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSmartList, partitionLists, SMART_LIST_VIEW, smartListSearchParamsFromFilters } from "@/lib/crm/smart-lists";
import { cn } from "@/lib/utils";
import type { ContactSegment } from "@/types/database";

const LIST_META_KEYS = new Set(["list", "view", "select"]);

export function ContactsListTabs({
  segments,
  ownerId,
  variant = "tabs",
}: {
  segments: ContactSegment[];
  ownerId: string;
  variant?: "tabs" | "picker";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const activeList = searchParams.get("list");
  const { staticLists, smartLists } = partitionLists(segments);
  const smartView = searchParams.get("view") === SMART_LIST_VIEW || isSmartList(segments.find((s) => s.id === activeList));

  function go(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function openAll() {
    go(new URLSearchParams());
  }

  function openSegment(seg: ContactSegment) {
    if (isSmartList(seg)) {
      const params = smartListSearchParamsFromFilters(seg.filters);
      params.set("list", seg.id);
      go(params);
      return;
    }
    const params = new URLSearchParams(seg.filters as Record<string, string>);
    params.set("list", seg.id);
    go(params);
  }

  function openSmartBuilder() {
    const params = new URLSearchParams();
    params.set("view", SMART_LIST_VIEW);
    go(params);
  }

  async function saveView() {
    if (!name.trim()) return;
    const filters = Object.fromEntries([...searchParams.entries()].filter(([key]) => !LIST_META_KEYS.has(key)));
    const supabase = createClient();
    const { data, error } = await supabase
      .from("contact_segments")
      .insert({ owner_id: ownerId, name: name.trim(), filters })
      .select("id")
      .maybeSingle();
    if (error || !data) return;
    setName("");
    setSaving(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("list", data.id);
    go(params);
    router.refresh();
  }

  if (variant === "picker") {
    return (
      <div className="space-y-2">
        <select
          value={smartView && !activeList ? "__smart__" : (activeList ?? "")}
          onChange={(e) => {
            const id = e.target.value;
            if (!id) {
              openAll();
              return;
            }
            if (id === "__smart__") {
              openSmartBuilder();
              return;
            }
            const seg = segments.find((s) => s.id === id);
            if (seg) openSegment(seg);
          }}
          className="w-full rounded-[11px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-800"
        >
          <option value="">All contacts</option>
          {staticLists.length > 0 && (
            <optgroup label="Static lists">
              {staticLists.map((seg) => (
                <option key={seg.id} value={seg.id}>
                  {seg.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Smart lists">
            <option value="__smart__">Smart List Builder</option>
            {smartLists.map((seg) => (
              <option key={seg.id} value={seg.id}>
                {seg.name}
              </option>
            ))}
          </optgroup>
        </select>
        {saving ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void saveView();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="List name"
              className="h-8 flex-1 rounded-lg border border-neutral-200 px-2 text-[13px] text-neutral-900"
            />
            <button type="submit" disabled={!name.trim()} className="text-[13px] font-semibold text-[#c45c4a] disabled:opacity-40">
              Save
            </button>
            <button type="button" onClick={() => setSaving(false)} className="text-[13px] text-neutral-400">
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="inline-flex items-center gap-1 text-[14px] font-medium text-[#c45c4a]"
          >
            <Plus size={14} /> Save view as list
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[#eadfd6]">
      <button
        type="button"
        onClick={openAll}
        className={cn(
          "-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium",
          !activeList && !smartView ? "border-[#c45c4a] font-semibold text-[#c45c4a]" : "border-transparent text-neutral-500 hover:text-neutral-800",
        )}
      >
        All contacts
      </button>
      {staticLists.map((seg) => (
        <button
          key={seg.id}
          type="button"
          onClick={() => openSegment(seg)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-[14px] font-medium",
            !smartView && activeList === seg.id ? "border-[#c45c4a] font-semibold text-[#c45c4a]" : "border-transparent text-neutral-500 hover:text-neutral-800",
          )}
        >
          {seg.name}
        </button>
      ))}
      <button
        type="button"
        onClick={openSmartBuilder}
        className={cn(
          "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[14px] font-medium",
          smartView ? "border-[#c45c4a] font-semibold text-[#c45c4a]" : "border-transparent text-neutral-500 hover:text-neutral-800",
        )}
      >
        <Zap size={13} /> Smart lists
      </button>
      {saving ? (
        <form
          className="mb-1 ml-1 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void saveView();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            className="h-8 w-36 rounded-lg border border-neutral-200 px-2 text-[13px] text-neutral-900"
          />
          <button type="submit" disabled={!name.trim()} className="text-[13px] font-semibold text-[#c45c4a] disabled:opacity-40">
            Save
          </button>
          <button type="button" onClick={() => setSaving(false)} className="text-[13px] text-neutral-400">
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSaving(true)}
          className="mb-0.5 ml-1 inline-flex items-center gap-1 px-2 py-2.5 text-[14px] font-medium text-[#c45c4a]"
        >
          <Plus size={14} /> Save view as list
        </button>
      )}
    </div>
  );
}
