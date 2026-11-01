"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Select } from "@/components/ui";
import { cn, RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS, relationshipTypeColor, stageColor } from "@/lib/utils";
import type { PipelineStage, Tag } from "@/types/database";
import {
  CONTACTS_V2_FILTER_KEYS,
  EVER_ATTENDED_EVENT,
  SHEET_PARAM_KEYS,
} from "@/lib/crm/contact-filter-params";
import { CONTACT_SOURCE_FILTERS, leadSourceMatches, sourceFilterByValue } from "@/lib/crm/contact-sources";
import { ColorDot } from "@/components/ui/ColorPill";

// Collapsible category. Opens by default when something in it is selected,
// and shows how many are selected while closed.
function Section({ title, children, selected = 0 }: { title: string; children: React.ReactNode; selected?: number }) {
  const [open, setOpen] = useState(selected > 0);
  return (
    <div className="border-b border-[#ddd7da] last:border-b-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 py-3 text-left">
        <span className="flex-1 text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-500">{title}</span>
        {selected > 0 && (
          <span className="rounded-full bg-[#34223a] px-2 py-0.5 text-[11px] font-semibold text-peach">{selected}</span>
        )}
        <ChevronDown size={16} className={cn("text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-2.5 pb-4">{children}</div>}
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
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-[#34223a]" : "bg-neutral-200")}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]", checked ? "left-5" : "left-0.5")} />
      </button>
    </label>
  );
}

function sourceDraftValue(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .split(",")
    .filter(Boolean)
    .map((s) => sourceFilterByValue(s)?.value ?? s)
    .join(",");
}

export function ContactFiltersSheet({
  stages,
  tags,
  leadSources,
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

  // stage, type and source are comma-separated lists of checked values.
  function toggleIn(key: "stage" | "type" | "source" | "tags", value: string) {
    const current = (draft[key] ?? "").split(",").filter(Boolean);
    const next = current.includes(value) ? current.filter((s) => s !== value) : [...current, value];
    set(key, next.join(","));
  }
  const checkedIn = (key: "type" | "source" | "tags", value: string) => (draft[key] ?? "").split(",").includes(value);
  const countOf = (key: string) => (draft[key] ?? "").split(",").filter(Boolean).length;

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

  // Sources typed on contacts that aren't one of the standard ones, so a
  // newly added source can be filtered on too. (Comma-containing values
  // are skipped - the URL keeps the list comma-separated.)
  const customSources = leadSources
    .filter((s) => !s.includes(",") && !CONTACT_SOURCE_FILTERS.some((b) => leadSourceMatches(s, b.value)))
    .map((s) => ({ value: s, label: s }));
  const selectedStages = new Set((draft.stage ?? "").split(",").filter(Boolean));
  const everAttended = !!draft.event;
  const specificEvent = draft.event && draft.event !== EVER_ATTENDED_EVENT ? draft.event : "";

  const chrome =
    variant === "panel"
      ? "flex h-full w-full max-w-none flex-col border-l border-[#ddd7da] bg-[#fcfbfb]"
      : "flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-[#fcfbfb] shadow-xl sm:rounded-2xl";

  const body = (
    <div className={chrome}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ddd7da] px-5 py-4">
        <p className="font-serif text-xl font-semibold text-neutral-900">Filters</p>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-[#f5e6dc]" aria-label="Close filters">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1">
        <Section title="Source" selected={countOf("source")}>
          <div className="space-y-2">
            {[...CONTACT_SOURCE_FILTERS, ...customSources].map((source) => (
              <label key={source.value} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={checkedIn("source", source.value)}
                  onChange={() => toggleIn("source", source.value)}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                />
                {source.label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Type" selected={countOf("type")}>
          <div className="space-y-2">
            {RELATIONSHIP_TYPES.map((value) => (
              <label key={value} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={checkedIn("type", value)}
                  onChange={() => toggleIn("type", value)}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                />
                <ColorDot color={relationshipTypeColor(value)} />
                {RELATIONSHIP_TYPE_LABELS[value]}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Stage" selected={countOf("stage")}>
          <div className="space-y-2">
            {stages.map((stage) => (
              <label key={stage.id} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={selectedStages.has(stage.id)}
                  onChange={() => toggleIn("stage", stage.id)}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                />
                <ColorDot color={stageColor(stage)} />
                {stage.name}
              </label>
            ))}
            {stages.length === 0 && <p className="text-[13px] text-neutral-400">No stages yet.</p>}
          </div>
        </Section>

        <Section title="Tags" selected={countOf("tags")}>
          <div className="space-y-2">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={checkedIn("tags", tag.id)}
                  onChange={() => toggleIn("tags", tag.id)}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                />
                <ColorDot color={tag.color} />
                <span className="min-w-0 truncate">{tag.name}</span>
              </label>
            ))}
            {tags.length === 0 && <p className="text-[13px] text-neutral-400">No tags yet - add them from a contact.</p>}
            {tags.length > 1 && <p className="text-[12px] text-neutral-400">Checking several shows people with any of them.</p>}
          </div>
        </Section>

        <Section title="Events" selected={draft.event ? 1 : 0}>
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

        <Section title="Contact by" selected={(draft.phone === "1" ? 1 : 0) + (draft.email === "1" ? 1 : 0)}>
          <div className="space-y-2">
            {(
              [
                ["phone", "Phone"],
                ["email", "Email"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                <input
                  type="checkbox"
                  checked={draft[key] === "1"}
                  onChange={(e) => set(key, e.target.checked ? "1" : "")}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                />
                {label}
              </label>
            ))}
            <p className="text-[12px] text-neutral-400">Checking both shows people with a phone and an email.</p>
          </div>
        </Section>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#ddd7da] px-5 py-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-[#34223a] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#34223a]"
        >
          Reset
        </button>
        <button type="button" onClick={apply} className="rounded-xl bg-[#34223a] px-4 py-2.5 text-[14px] font-semibold text-peach">
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
