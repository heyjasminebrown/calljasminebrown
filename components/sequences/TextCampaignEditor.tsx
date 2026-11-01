"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { saveTextCampaign } from "@/app/(app)/sequences/text-campaign-actions";
import { TRIGGER_LABELS, validateCampaign, type CampaignStepInput, type TriggerType } from "@/lib/crm/text-campaign-rules";
import { RELATIONSHIP_TYPES, RELATIONSHIP_TYPE_LABELS } from "@/lib/utils";
import type { PipelineStage, Tag } from "@/types/database";

export type EditableCampaign = {
  id?: string;
  name: string;
  trigger_type: TriggerType;
  trigger_value: string;
  steps: CampaignStepInput[];
  skip_campaign_ids?: string[];
};

// 1-30 days, plus a longer saved value so it still shows.
const dayOptions = (current?: number) => {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  return current && current > 30 ? [...days, current] : days;
};

const newStepId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const blankStep = (): CampaignStepInput => ({ id: newStepId(), label: "", body: "", onReply: { next: null }, onNoReply: { next: null } });

// Create / edit a text campaign. The first text goes out right away; every
// text says what happens if they reply (not a clear no) and if they don't.
// The stop rules (STOP, a clear no, archived/spam, you reaching out) aren't
// options here - they always apply.
export function TextCampaignEditor({
  campaign,
  tags,
  stages,
  sources,
  otherCampaigns,
  onClose,
}: {
  campaign?: EditableCampaign;
  otherCampaigns: { id: string; name: string }[];
  tags: Tag[];
  stages: PipelineStage[];
  sources: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(campaign?.trigger_type ?? "source");
  const [triggerValue, setTriggerValue] = useState(campaign?.trigger_value ?? "");
  const [steps, setSteps] = useState<CampaignStepInput[]>(campaign?.steps.length ? campaign.steps : [blankStep()]);
  const [skipIds, setSkipIds] = useState<string[]>(campaign?.skip_campaign_ids ?? []);
  const skippable = otherCampaigns.filter((c) => c.id !== campaign?.id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const labeled = steps.map((s, i) => ({ ...s, label: `Text ${i + 1}` }));
  const labelOf = (id: string) => labeled.find((s) => s.id === id)?.label ?? "a removed text";

  function patchStep(id: string, patch: (s: CampaignStepInput) => CampaignStepInput) {
    setSteps((prev) => prev.map((s) => (s.id === id ? patch(s) : s)));
  }

  function removeStep(id: string) {
    setSteps((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s) => ({
          ...s,
          onReply: s.onReply.next === id ? { next: null } : s.onReply,
          onNoReply: s.onNoReply.next === id ? { next: null } : s.onNoReply,
        })),
    );
  }

  async function save() {
    setError("");
    const input = { id: campaign?.id, name, triggerType, triggerValue, steps: labeled, skipCampaignIds: skipIds };
    const problem = validateCampaign(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const result = await saveTextCampaign(input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <p className="font-serif text-xl font-semibold text-neutral-900">{campaign?.id ? "Edit text campaign" : "New text campaign"}</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <Label htmlFor="tc-name">Campaign name</Label>
            <Input id="tc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conventus Text Campaign" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tc-trigger">Starts when</Label>
              <Select
                id="tc-trigger"
                value={triggerType}
                onChange={(e) => {
                  setTriggerType(e.target.value as TriggerType);
                  setTriggerValue("");
                }}
              >
                {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tc-value">{triggerType === "source" ? "Source" : triggerType === "tag" ? "Tag" : triggerType === "type" ? "Type" : "Stage"}</Label>
              {triggerType === "source" ? (
                <>
                  <Input id="tc-value" list="tc-sources" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} placeholder="e.g. Conventus" />
                  <datalist id="tc-sources">
                    {sources.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              ) : (
                <Select id="tc-value" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)}>
                  <option value="">Choose…</option>
                  {triggerType === "tag" && tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  {triggerType === "type" && RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>)}
                  {triggerType === "stage" && stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {labeled.map((step, i) => {
              // Only later texts: pointing back to an earlier one would loop.
              const later = labeled.slice(i + 1);
              const backward = (id: string | null) => !!id && !later.some((o) => o.id === id);
              const badOption = (id: string | null) =>
                backward(id) ? (
                  <option value={id!}>⚠ Send {labelOf(id!)} (goes backward - pick another)</option>
                ) : null;
              return (
                <div key={step.id} className="rounded-xl border border-[#ddd7da] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-800">
                      {step.label}
                      {i === 0 && <span className="ml-2 font-normal text-neutral-500">sent right away</span>}
                    </p>
                    {labeled.length > 1 && (
                      <button type="button" onClick={() => removeStep(step.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${step.label}`}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={3}
                    value={step.body}
                    onChange={(e) => patchStep(step.id, (s) => ({ ...s, body: e.target.value }))}
                    placeholder="Hey [First Name], it's Jasmine…"
                  />
                  <p className="mt-1 text-xs text-neutral-400">[First Name] is replaced with their first name.</p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label>If they reply (not a clear no)</Label>
                      <Select
                        value={step.onReply.next ?? ""}
                        onChange={(e) => patchStep(step.id, (s) => ({ ...s, onReply: { next: e.target.value || null } }))}
                      >
                        <option value="">End the campaign</option>
                        {badOption(step.onReply.next)}
                        {later.map((o) => (
                          <option key={o.id} value={o.id}>
                            Send {o.label} (~1 min later)
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>If no reply</Label>
                      <Select
                        value={step.onNoReply.next ?? ""}
                        onChange={(e) =>
                          patchStep(step.id, (s) => ({
                            ...s,
                            onNoReply: e.target.value
                              ? { next: e.target.value, days: s.onNoReply.days ?? 1, time: s.onNoReply.time ?? "16:30" }
                              : { next: null },
                          }))
                        }
                      >
                        <option value="">End the campaign</option>
                        {badOption(step.onNoReply.next)}
                        {later.map((o) => (
                          <option key={o.id} value={o.id}>
                            Send {o.label}
                          </option>
                        ))}
                      </Select>
                      {step.onNoReply.next && (
                        <>
                          <Select
                            className="mt-2"
                            value={step.onNoReply.days === 0 ? "now" : "later"}
                            onChange={(e) =>
                              patchStep(step.id, (s) => ({
                                ...s,
                                onNoReply:
                                  e.target.value === "now"
                                    ? { next: s.onNoReply.next, days: 0 }
                                    : { next: s.onNoReply.next, days: 1, time: s.onNoReply.time ?? "16:30" },
                              }))
                            }
                            aria-label="When"
                          >
                            <option value="now">Right after this text (~1 min)</option>
                            <option value="later">Days later at a set time</option>
                          </Select>
                          {step.onNoReply.days !== 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                              <Select
                                className="!w-[84px] shrink-0"
                                value={String(Number.isFinite(step.onNoReply.days) ? step.onNoReply.days : 1)}
                                onChange={(e) => patchStep(step.id, (s) => ({ ...s, onNoReply: { ...s.onNoReply, days: Number(e.target.value) } }))}
                                aria-label="Days later"
                              >
                                {dayOptions(step.onNoReply.days).map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </Select>
                              <span className="shrink-0">day(s) later at</span>
                              <Input
                                type="time"
                                className="!w-36 shrink-0"
                                value={step.onNoReply.time ?? "16:30"}
                                onChange={(e) => patchStep(step.id, (s) => ({ ...s, onNoReply: { ...s.onNoReply, time: e.target.value } }))}
                                aria-label="Time (ET)"
                              />
                              <span className="shrink-0">ET</span>
                            </div>
                          )}
                          {step.onNoReply.days === 0 && (
                            <p className="mt-1 text-xs text-neutral-400">Sent even if they reply in that minute; their reply is handled after it.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {step.onReply.next && <p className="mt-2 text-xs text-neutral-400">{labelOf(step.onReply.next)} ends the campaign after it&apos;s sent - they&apos;re talking to you now.</p>}
                </div>
              );
            })}
            <Button type="button" variant="secondary" onClick={() => setSteps((prev) => [...prev, blankStep()])}>
              <Plus size={14} /> Add a text
            </Button>
          </div>

          {skippable.length > 0 && (
            <div>
              <Label>Skip anyone who&apos;s already in</Label>
              <div className="mt-1 space-y-1.5">
                {skippable.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 text-[14px] text-neutral-800">
                    <input
                      type="checkbox"
                      checked={skipIds.includes(c.id)}
                      onChange={() => setSkipIds((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                      className="h-4 w-4 rounded border-neutral-300 accent-[#34223a]"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-400">So nobody gets the same invite twice from two campaigns.</p>
            </div>
          )}

          <div className="rounded-xl bg-[#f4f1f5] p-3 text-xs leading-5 text-neutral-600">
            <p className="font-semibold text-neutral-700">Always on, for every campaign</p>
            Stops when they reply STOP, reply with a clear no, are archived or marked spam, or when you text or call them yourself.
            To include people who already match (e.g. already have the tag), use the add-people button on the campaign after saving.
            At most 2 texts a minute. Nothing sends between 8 PM and 9 AM ET. Each contact goes through a campaign once. New
            campaigns start Off - switch them on when you&apos;re ready.
          </div>
        </div>

        <div className="shrink-0 border-t border-neutral-100 px-5 py-4">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={() => void save()} disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save campaign"}
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
