"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { campaignsTextHref } from "@/lib/crm/campaigns-handoff";
import { hasUsablePhone } from "@/lib/crm/contact-filter-predicates";
import {
  applyRulesToSearchParams,
  encodeTagOrListValue,
  isSmartList,
  partitionLists,
  rulesFromSearchParams,
  smartListFiltersToStore,
  type SmartListRule,
  type SmartListRuleField,
} from "@/lib/crm/smart-lists";
import { cn } from "@/lib/utils";
import type { ContactSegment, ContactWithRelations, PipelineStage, Tag } from "@/types/database";

const FIELD_OPTIONS: { value: SmartListRuleField; label: string }[] = [
  { value: "stage", label: "Stage" },
  { value: "tag_or_list", label: "Tag / List includes" },
  { value: "last_touch", label: "Last touch older than" },
];

export function SmartListBuilder({
  contacts,
  stages,
  tags,
  segments,
  ownerId,
  variant = "desktop",
  onTextNext,
}: {
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  tags: Tag[];
  segments: ContactSegment[];
  ownerId: string;
  variant?: "desktop" | "mobile";
  onTextNext?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { staticLists } = partitionLists(segments);
  const membershipLists = staticLists.filter((seg) => typeof (seg.filters as { ids?: string }).ids === "string");
  const activeList = searchParams.get("list");
  const activeSmart = segments.find((seg) => seg.id === activeList && isSmartList(seg));

  const [rules, setRules] = useState<SmartListRule[]>(() => rulesFromSearchParams(searchParams));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(activeSmart?.name ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setRules(rulesFromSearchParams(searchParams));
    setName(activeSmart?.name ?? "");
  }, [searchParams, activeSmart?.name]);

  function pushRules(nextRules: SmartListRule[]) {
    setRules(nextRules);
    const params = applyRulesToSearchParams(searchParams, nextRules);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function updateRule(id: string, patch: Partial<SmartListRule>) {
    pushRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch, value: patch.field && patch.field !== rule.field ? "" : (patch.value ?? rule.value) } : rule)));
  }

  function addRule() {
    pushRules([...rules, { id: `rule-${crypto.randomUUID()}`, field: "stage", value: "" }]);
  }

  function removeRule(id: string) {
    if (rules.length <= 1) {
      pushRules(rules.map((rule) => (rule.id === id ? { ...rule, value: "" } : rule)));
      return;
    }
    pushRules(rules.filter((rule) => rule.id !== id));
  }

  async function save() {
    if (!name.trim()) {
      setSaving(true);
      setError("");
      return;
    }
    setError("");
    const supabase = createClient();
    const filters = smartListFiltersToStore(applyRulesToSearchParams(searchParams, rules));
    if (activeSmart) {
      const { error: updateError } = await supabase.from("contact_segments").update({ name: name.trim(), filters }).eq("id", activeSmart.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSaving(false);
      router.refresh();
      return;
    }
    const { data, error: insertError } = await supabase
      .from("contact_segments")
      .insert({ owner_id: ownerId, name: name.trim(), filters })
      .select("id")
      .maybeSingle();
    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save this smart list.");
      return;
    }
    setSaving(false);
    const params = applyRulesToSearchParams(searchParams, rules);
    params.set("list", data.id);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  function textNext() {
    if (onTextNext) {
      onTextNext();
      return;
    }
    const ids = contacts.filter((c) => hasUsablePhone(c.phone)).map((c) => c.id);
    if (ids.length) router.push(campaignsTextHref(ids));
  }

  function addToCampaign() {
    const ids = contacts.filter((c) => hasUsablePhone(c.phone)).map((c) => c.id);
    if (ids.length) router.push(campaignsTextHref(ids));
  }

  const phoneCount = contacts.filter((c) => hasUsablePhone(c.phone)).length;
  const mobile = variant === "mobile";

  return (
    <section className={cn("overflow-hidden rounded-[16px] border border-[#eadfd6] bg-white", mobile && "rounded-[14px]")}>
      <div className="border-b border-[#eadfd6] px-4 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-[.06em] text-neutral-400">Rules</p>
      </div>
      <div className="divide-y divide-[#f3e4dc]">
        {rules.map((rule, index) => (
          <div key={rule.id} className={cn("grid items-center gap-2 px-4 py-3", mobile ? "grid-cols-1" : "grid-cols-[72px_minmax(0,1.2fr)_minmax(0,1fr)_auto]")}>
            <span className="text-[12px] font-semibold uppercase tracking-[.06em] text-[#c45c4a]">{index === 0 ? "If" : "And"}</span>
            <select
              value={rule.field}
              onChange={(e) => updateRule(rule.id, { field: e.target.value as SmartListRuleField })}
              className="rounded-[10px] border border-[#eadfd6] bg-[#fffdfb] px-2.5 py-2 text-[13px] text-neutral-800"
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <RuleValue
              rule={rule}
              stages={stages}
              tags={tags}
              lists={membershipLists}
              onChange={(value) => updateRule(rule.id, { value })}
            />
            <button type="button" onClick={() => removeRule(rule.id)} className="justify-self-end p-1.5 text-neutral-300 hover:text-neutral-600" aria-label="Remove rule">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5">
        <button type="button" onClick={addRule} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#c45c4a]">
          <Plus size={14} /> Add AND condition
        </button>
      </div>

      <div className="border-t border-[#eadfd6] px-4 py-4">
        <p className="font-serif text-[18px] font-semibold text-neutral-900">
          Match count: {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </p>
        {saving ? (
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Smart list name"
              className="h-10 min-w-[180px] flex-1 rounded-[10px] border border-[#eadfd6] px-3 text-[14px] text-neutral-900"
            />
            <button type="submit" disabled={!name.trim()} className="text-[13px] font-semibold text-[#c45c4a] disabled:opacity-40">
              Save
            </button>
            <button type="button" onClick={() => setSaving(false)} className="text-[13px] text-neutral-400">
              Cancel
            </button>
          </form>
        ) : (
          <div className={cn("mt-3 grid gap-2", mobile ? "grid-cols-1" : "grid-cols-3")}>
            <ActionButton filled onClick={() => void save()}>
              Save
            </ActionButton>
            <ActionButton onClick={textNext} disabled={phoneCount === 0}>
              Text & Next
            </ActionButton>
            <ActionButton filled onClick={addToCampaign} disabled={phoneCount === 0}>
              Add to campaign
            </ActionButton>
          </div>
        )}
        {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
      </div>
    </section>
  );
}

function RuleValue({
  rule,
  stages,
  tags,
  lists,
  onChange,
}: {
  rule: SmartListRule;
  stages: PipelineStage[];
  tags: Tag[];
  lists: ContactSegment[];
  onChange: (value: string) => void;
}) {
  if (rule.field === "last_touch") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={rule.value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="14"
          className="w-full rounded-[10px] border border-[#eadfd6] bg-[#fffdfb] px-2.5 py-2 text-[13px] text-neutral-800"
        />
        <span className="shrink-0 text-[12px] text-neutral-400">days</span>
      </div>
    );
  }

  if (rule.field === "stage") {
    return (
      <select
        value={rule.value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[10px] border border-[#eadfd6] bg-[#fffdfb] px-2.5 py-2 text-[13px] text-neutral-800"
      >
        <option value="">Any stage</option>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      value={rule.value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[10px] border border-[#eadfd6] bg-[#fffdfb] px-2.5 py-2 text-[13px] text-neutral-800"
    >
      <option value="">Any tag or list</option>
      {tags.length > 0 && (
        <optgroup label="Tags">
          {tags.map((tag) => (
            <option key={tag.id} value={encodeTagOrListValue("tag", tag.id)}>
              {tag.name}
            </option>
          ))}
        </optgroup>
      )}
      {lists.length > 0 && (
        <optgroup label="Static lists">
          {lists.map((list) => (
            <option key={list.id} value={encodeTagOrListValue("list", list.id)}>
              {list.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  filled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl px-3 py-2.5 text-[14px] font-semibold disabled:opacity-40",
        filled ? "bg-[#c45c4a] text-white" : "border border-[#c45c4a] bg-white text-[#c45c4a]",
      )}
    >
      {children}
    </button>
  );
}
