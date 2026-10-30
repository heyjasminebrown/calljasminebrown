"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendTestEmailDraft } from "@/app/(app)/sequences/actions";
import { Button, Input, Select, Card, Label, Badge } from "@/components/ui";
import { EmailBodyEditor } from "@/components/sequences/EmailBodyEditor";
import { EmailTemplateButtons, EmailPreviewTest } from "@/components/sequences/EmailComposerHelpers";
import { RateBar } from "@/components/sequences/RateBar";
import { formatLocal } from "@/lib/format-time";
import { fullName, shortenUrl } from "@/lib/utils";
import { ArrowUp, ArrowDown, Trash2, Plus, Pause, Play } from "lucide-react";
import type { EmailSequenceStep, SequenceType } from "@/types/database";
import type { StepStats, LinkClickBreakdown } from "@/lib/data/sequences";

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// sentCount comes from real email_sequence_sends rows, not just clock
// time - the previous version called a step "Sent" purely because its
// send_at had passed, even if the cron hadn't actually run yet (or every
// recipient turned out unreachable). "Sending…" covers that in-between
// state honestly instead of claiming a send that hasn't happened.
function StatusChip({ step, type, sentCount }: { step: EmailSequenceStep; type: SequenceType; sentCount: number }) {
  if (!step.active) return <Badge className="bg-neutral-100 text-neutral-500">Paused</Badge>;
  if (type === "drip") return null;
  if (!step.send_at) return null;
  if (sentCount > 0) return <Badge className="bg-emerald-50 text-emerald-700">Sent</Badge>;
  const isFuture = new Date(step.send_at).getTime() > Date.now();
  return isFuture ? (
    <Badge className="bg-brand-50 text-brand-700">Scheduled</Badge>
  ) : (
    <Badge className="bg-amber-50 text-amber-700">Sending…</Badge>
  );
}

// Reordering N items by swapping step_order values can transiently collide
// with the unique(sequence_id, step_order) constraint depending on request
// timing. Moving everything to guaranteed-unused negative placeholders
// first, then assigning final positions, avoids that regardless of how the
// requests interleave.
async function persistOrder(steps: EmailSequenceStep[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const placeholderResults = await Promise.all(steps.map((step, i) => supabase.from("email_sequence_steps").update({ step_order: -(i + 1) }).eq("id", step.id)));
  const placeholderError = placeholderResults.find((r) => r.error)?.error;
  if (placeholderError) return { ok: false, error: placeholderError.message };

  const finalResults = await Promise.all(steps.map((step, i) => supabase.from("email_sequence_steps").update({ step_order: i }).eq("id", step.id)));
  const finalError = finalResults.find((r) => r.error)?.error;
  if (finalError) return { ok: false, error: finalError.message };

  return { ok: true };
}

export function StepManager({
  sequenceId,
  type,
  steps,
  stats,
  linkBreakdown,
}: {
  sequenceId: string;
  type: SequenceType;
  steps: EmailSequenceStep[];
  stats: Map<string, StepStats>;
  linkBreakdown: Map<string, LinkClickBreakdown[]>;
}) {
  const router = useRouter();
  const sorted = [...steps].sort((a, b) => a.step_order - b.step_order);
  const [adding, setAdding] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  async function updateStep(id: string, patch: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = createClient();
    const { error } = await supabase.from("email_sequence_steps").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    router.refresh();
    return { ok: true };
  }

  async function deleteStep(id: string) {
    if (!confirm("Delete this step? Its send history/tracking stays on record, but it'll never send again.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("email_sequence_steps").delete().eq("id", id);
    if (error) {
      alert(`Couldn't delete this step: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = sorted[index + direction];
    if (!target) return;
    setOrderError(null);
    const reordered = [...sorted];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    const result = await persistOrder(reordered);
    if (!result.ok) {
      setOrderError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {orderError && <p className="text-sm font-medium text-red-600">Couldn&apos;t reorder: {orderError}</p>}
      {sorted.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          type={type}
          index={i}
          isLast={i === sorted.length - 1}
          stats={stats.get(step.id)}
          links={linkBreakdown.get(step.id) ?? []}
          updateStep={updateStep}
          deleteStep={deleteStep}
          move={move}
        />
      ))}

      {adding ? (
        <NewStepForm
          sequenceId={sequenceId}
          type={type}
          nextOrder={(sorted.at(-1)?.step_order ?? -1) + 1}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add step
        </Button>
      )}
    </div>
  );
}

function StepCard({
  step,
  type,
  index,
  isLast,
  stats,
  links,
  updateStep,
  deleteStep,
  move,
}: {
  step: EmailSequenceStep;
  type: SequenceType;
  index: number;
  isLast: boolean;
  stats: StepStats | undefined;
  links: LinkClickBreakdown[];
  updateStep: (id: string, patch: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteStep: (id: string) => Promise<void>;
  move: (index: number, direction: -1 | 1) => Promise<void>;
}) {
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function update(patch: Record<string, unknown>) {
    const result = await updateStep(step.id, patch);
    setFieldError(result.ok ? null : result.error);
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-neutral-400">Step {index + 1}</span>
          <StatusChip step={step} type={type} sentCount={stats?.sent ?? 0} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => update({ active: !step.active })}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
            aria-label={step.active ? "Pause this step" : "Resume this step"}
            title={step.active ? "Pause this step" : "Resume this step"}
          >
            {step.active ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={() => move(index, -1)}
            disabled={index === 0}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={() => move(index, 1)}
            disabled={isLast}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={() => deleteStep(step.id)}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete step"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {fieldError && <p className="text-xs font-medium text-red-600">Couldn&apos;t save: {fieldError}</p>}
      <EmailTemplateButtons onPick={setBody} />
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        onBlur={(e) => e.target.value !== step.subject && update({ subject: e.target.value })}
      />
      <EmailBodyEditor
        value={body}
        onChange={setBody}
        placeholder="Email body — use {{first_name}} to personalize"
        onBlur={() => body !== step.body && update({ body })}
      />
      {type !== "drip" ? (
        <div>
          <Label htmlFor={`step-send-at-${step.id}`}>Send at (Eastern time)</Label>
          <Input
            id={`step-send-at-${step.id}`}
            type="datetime-local"
            defaultValue={toDatetimeLocal(step.send_at)}
            onBlur={(e) => e.target.value && update({ send_at: new Date(e.target.value).toISOString() })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`step-delay-${step.id}`}>Delay {index === 0 ? "after joining" : "after previous step"}</Label>
            <Input
              id={`step-delay-${step.id}`}
              type="number"
              min={0}
              defaultValue={step.delay_amount ?? 0}
              onBlur={(e) => update({ delay_amount: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor={`step-delay-unit-${step.id}`}>Unit</Label>
            <Select
              id={`step-delay-unit-${step.id}`}
              defaultValue={step.delay_unit ?? "days"}
              onChange={(e) => update({ delay_unit: e.target.value })}
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </Select>
          </div>
        </div>
      )}

      <div className="border-t border-neutral-100 pt-2">
        <EmailPreviewTest subject={subject} body={body} onSendTest={() => sendTestEmailDraft(subject, body)} />
      </div>

      {stats && stats.sent > 0 && (
        <div className="grid grid-cols-3 gap-3 border-t border-neutral-100 pt-2">
          <RateBar label="Opened" count={stats.opened} total={stats.sent} color="bg-brand-500" />
          <RateBar label="Clicked" count={stats.clicked} total={stats.sent} color="bg-emerald-500" />
          <RateBar label="Unsubscribed" count={stats.unsubscribed} total={stats.sent} color="bg-red-400" />
        </div>
      )}
      {stats && stats.sent > 0 && type !== "drip" && step.send_at && (
        <p className="text-[10px] text-neutral-400">Sent {formatLocal(step.send_at, "MMM d, h:mm a")}</p>
      )}

      {links.length > 0 && (
        <div className="space-y-1.5 border-t border-neutral-100 pt-2">
          <p className="text-xs font-medium text-neutral-500">Link clicks</p>
          {links.map((l) => (
            <div key={l.url}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-brand-600 hover:underline">
                  {shortenUrl(l.url)}
                </a>
                <span className="shrink-0 text-neutral-400">{l.count}×</span>
              </div>
              {l.contacts.length > 0 && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{l.contacts.map((c) => fullName(c)).join(", ")}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function NewStepForm({
  sequenceId,
  type,
  nextOrder,
  onDone,
  onCancel,
}: {
  sequenceId: string;
  type: SequenceType;
  nextOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [delayAmount, setDelayAmount] = useState("1");
  const [delayUnit, setDelayUnit] = useState<"hours" | "days">("days");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    if (type !== "drip" && !sendAt) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.from("email_sequence_steps").insert({
      sequence_id: sequenceId,
      step_order: nextOrder,
      subject: subject.trim(),
      body: body.trim(),
      send_at: type !== "drip" ? new Date(sendAt).toISOString() : null,
      delay_amount: type === "drip" ? Number(delayAmount) : null,
      delay_unit: type === "drip" ? delayUnit : null,
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    onDone();
  }

  return (
    <Card className="space-y-2">
      <form onSubmit={handleAdd} className="space-y-2">
        <EmailTemplateButtons onPick={setBody} />
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        <EmailBodyEditor value={body} onChange={setBody} placeholder="Email body — use {{first_name}} to personalize" />
        <EmailPreviewTest subject={subject} body={body} onSendTest={() => sendTestEmailDraft(subject, body)} />
        {type !== "drip" ? (
          <div>
            <Label htmlFor="new-step-send-at">Send at (Eastern time)</Label>
            <Input id="new-step-send-at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-step-delay">Delay</Label>
              <Input id="new-step-delay" type="number" min={0} value={delayAmount} onChange={(e) => setDelayAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-step-delay-unit">Unit</Label>
              <Select id="new-step-delay-unit" value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as "hours" | "days")}>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </Select>
            </div>
          </div>
        )}
        {saveError && <p className="text-xs font-medium text-red-600">Couldn&apos;t add this step: {saveError}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saving || !subject.trim() || !body.trim()}>
            {saving ? "Adding…" : "Add step"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
