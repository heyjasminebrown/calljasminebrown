"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PipelineStage, Tag } from "@/types/database";
import {
  CONTACTS_V2_FILTER_KEYS,
  EVER_ATTENDED_EVENT,
  SHEET_PARAM_KEYS,
} from "@/lib/crm/contact-filter-params";
import { CONTACT_SOURCE_FILTERS, sourceFilterByValue } from "@/lib/crm/contact-sources";

function Section({ title, children, flush }: { title: string; children: React.ReactNode; flush?: boolean }) {
  return (
    <div className={cn("space-y-2.5", !flush && "border-b border-[#eadfd6] pb-4 last:border-b-0")}>
      <p className="text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">{title}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-[14px] text-neutral-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-[#c45c4a]" : "bg-neutral-200")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]", checked ? "left-5" : "left-0.5")} />
      </button>
    </label>
  );
}

function sourceDraftValue(raw: string | undefined): string {
  if (!raw) return "";
  return sourceFilterByValue(raw)?.value ?? raw;
}

export function ContactFiltersSheet({
  stages,
  tags: _tags,
  leadSources: _leadSources,
  eventNames,
  registeredEventNames: _registeredEventNames = [],
  onClose,
  variant = "sheet",
}: {
  stages: PipelineStage[];
  tags: Tag[];
  leadSources: string[];
  eventNames: string[];
  registeredEventNames?: string[];
  onClose: () => void;
  variant?: "sheet" | "panel";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState(() => {
    const entries = Object.fromEntries(searchParams.entries());
    entries.source = sourceDraftValue(entries.source);
    return entries;
  });

  function set(key: string, value: string) {
    setDraft((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  function toggleStage(id: string) {
    const current = (draft.stage ?? "").split(",").filter(Boolean);
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
    set("stage", next.join(","));
  }

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of CONTACTS_V2_FILTER_KEYS) {
      const value = draft[key];
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    if (variant !== "panel") onClose();
  }

  function reset() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of SHEET_PARAM_KEYS) params.delete(key);
    const list = searchParams.get("list");
    if (list) params.set("list", list);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    if (variant !== "panel") onClose();
  }

  const selectedStages = new Set((draft.stage ?? "").split(",").filter(Boolean));
  const everAttended = !!draft.event;
  const specificEvent = draft.event && draft.event !== EVER_ATTENDED_EVENT ? draft.event : "";

  const chrome =
    variant === "panel"
      ? "flex h-full w-full max-w-none flex-col border-l border-[#eadfd6] bg-[#fffbf8]"
      : "flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-[#fffbf8] shadow-xl sm:rounded-2xl";

  const body = (
    <div className={chrome}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eadfd6] px-5 py-4">
        <p className="font-serif text-xl font-semibold text-neutral-900">Filters</p>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-[#f3e4dc]" aria-label="Close filters">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className={variant === "sheet" ? "grid grid-cols-2 gap-4 border-b border-[#eadfd6] pb-4" : "contents"}>
        <Section title="Source" flush={variant === "sheet"}>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-[14px] text-neutral-800">
              <input type="radio" name="source" checked={!draft.source} onChange={() => set("source", "")} className="accent-[#c45c4a]" />
              All
            </label>
            {CONTACT_SOURCE_FILTERS.map((source) => (
              <label key={source.value} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="radio"
                  name="source"
                  checked={draft.source === source.value}
                  onChange={() => set("source", source.value)}
                  className="accent-[#c45c4a]"
                />
                {source.label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Stage" flush={variant === "sheet"}>
          <div className="space-y-2">
            {stages.map((stage) => (
              <label key={stage.id} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={selectedStages.has(stage.id)}
                  onChange={() => toggleStage(stage.id)}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#c45c4a]"
                />
                {stage.name}
              </label>
            ))}
            {stages.length === 0 && <p className="text-[13px] text-neutral-400">No stages yet.</p>}
          </div>
        </Section>
        </div>

        <Section title="Events">
          <Toggle
            label="Ever attended"
            checked={everAttended}
            onChange={(on) => set("event", on ? specificEvent || EVER_ATTENDED_EVENT : "")}
          />
          <Select
            value={specificEvent}
            onChange={(e) => set("event", e.target.value || (everAttended ? EVER_ATTENDED_EVENT : ""))}
          >
            <option value="">Specific event</option>
            {eventNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Section>

        <Section title="Gender">
          <div className="space-y-2">
            {(
              [
                ["", "Any"],
                ["women", "Women"],
                ["men", "Men"],
                ["unknown", "Unknown"],
              ] as const
            ).map(([value, label]) => (
              <label key={label} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="radio"
                  name="gender"
                  checked={(draft.gender ?? "") === value}
                  onChange={() => set("gender", value)}
                  className="accent-[#c45c4a]"
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Has phone">
          <Toggle label="Has phone" checked={draft.phone === "1"} onChange={(on) => set("phone", on ? "1" : "")} />
        </Section>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#eadfd6] px-5 py-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-[#c45c4a] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#c45c4a]"
        >
          Reset
        </button>
        <button type="button" onClick={apply} className="rounded-xl bg-[#c45c4a] px-4 py-2.5 text-[14px] font-semibold text-white">
          Apply
        </button>
      </div>
    </div>
  );

  if (variant === "panel") return body;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      {body}
    </div>
  );
}
