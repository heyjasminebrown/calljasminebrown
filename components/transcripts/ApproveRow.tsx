"use client";

import { useState } from "react";
import { Pencil, X, Check } from "lucide-react";
import { TIMELINE_LABELS, formatCurrency } from "@/lib/utils";
import type { ProposedChange, PipelineStage } from "@/types/database";

const FIELD_LABELS: Record<string, string> = {
  budget: "Budget",
  timeline: "Timeline",
  areas_of_interest: "Areas of interest",
  decision_maker: "Decision maker",
  objection: "Objection",
  note: "New note on the record",
  task: "Task to create",
  stage: "Stage",
  showing: "Showing to log",
  tag: "Tag suggestion",
};

function formatSeconds(s: number | null) {
  if (s == null) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// What the row shows for "proposed value" and "current state," and what
// an edited value round-trips as - kept together since they share the
// exact same proposed_value JSON shape per field (see migration 0041's
// comment for the shape each field uses).
function describe(p: ProposedChange, stages: PipelineStage[]) {
  const value = p.proposed_value as Record<string, unknown>;
  const current = p.current_value as Record<string, unknown> | null;

  switch (p.field) {
    case "budget": {
      const v = value as { min: number | null; max: number | null };
      const proposed = v.min && v.max ? `${formatCurrency(v.min)}-${formatCurrency(v.max)}` : formatCurrency(v.min ?? v.max ?? null);
      const c = current as { min: number | null; max: number | null } | null;
      const was = c?.min || c?.max ? `${formatCurrency(c.min)}-${formatCurrency(c.max)}` : "was blank";
      return { proposed, meta: `· ${was}` };
    }
    case "timeline": {
      const v = value as { timeline: string };
      const c = current as { timeline: string } | null;
      return { proposed: TIMELINE_LABELS[v.timeline] ?? v.timeline, meta: c ? `· was ${TIMELINE_LABELS[c.timeline] ?? c.timeline}` : "" };
    }
    case "areas_of_interest": {
      const v = value as { area: string };
      return { proposed: v.area, meta: "· adds one" };
    }
    case "decision_maker":
    case "objection": {
      const v = value as { text: string };
      const c = current as { text: string } | null;
      return { proposed: v.text, meta: c?.text ? "· confirms what was on file" : "· was blank" };
    }
    case "note": {
      const v = value as { text: string };
      return { proposed: v.text, meta: "· new" };
    }
    case "showing": {
      const v = value as { address: string };
      return { proposed: v.address, meta: "· logs a showing" };
    }
    case "task": {
      const v = value as { title: string; dueAt: string | null };
      return { proposed: v.title, meta: v.dueAt ? `· due ${v.dueAt}` : "· new" };
    }
    case "stage": {
      const v = value as { stageId: string; stageName: string };
      const stage = stages.find((s) => s.id === v.stageId);
      return { proposed: stage?.name ?? v.stageName, meta: "" };
    }
    case "tag": {
      const v = value as { name: string };
      return { proposed: v.name, meta: "· adds a tag" };
    }
    default:
      return { proposed: "", meta: "" };
  }
}

type WriteResult = { ok: true } | { ok: false; error: string };

export function ApproveRow({
  proposal,
  stages,
  onAccept,
  onReject,
}: {
  proposal: ProposedChange;
  stages: PipelineStage[];
  onAccept: (p: ProposedChange) => Promise<WriteResult>;
  onReject: (p: ProposedChange) => Promise<WriteResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => {
    const v = proposal.proposed_value as Record<string, unknown>;
    if (proposal.field === "task") return (v.title as string) ?? "";
    if (proposal.field === "areas_of_interest") return (v.area as string) ?? "";
    if (proposal.field === "showing") return (v.address as string) ?? "";
    return (v.text as string) ?? "";
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { proposed, meta } = describe(proposal, stages);
  const isEditableText = ["decision_maker", "objection", "note", "task", "areas_of_interest", "showing"].includes(proposal.field);
  const timestampLabel = formatSeconds(proposal.timestamp_seconds);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    if (editing && isEditableText) {
      const key = proposal.field === "task" ? "title" : proposal.field === "areas_of_interest" ? "area" : proposal.field === "showing" ? "address" : "text";
      proposal.proposed_value = { ...(proposal.proposed_value as Record<string, unknown>), [key]: editValue };
    }
    const result = await onAccept(proposal);
    setBusy(false);
    if (result.ok) setDone("accepted");
    else setError(result.error);
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    const result = await onReject(proposal);
    setBusy(false);
    if (result.ok) setDone("rejected");
    else setError(result.error);
  }

  if (done) {
    return (
      <div className="border-t border-[#f5f5f4] px-4 py-3 text-sm text-neutral-400">
        {FIELD_LABELS[proposal.field]} — {done === "accepted" ? "Saved." : "Skipped."}
      </div>
    );
  }

  return (
    <div className="border-t border-[#f5f5f4] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-neutral-500">{FIELD_LABELS[proposal.field]}</p>
          {editing && isEditableText ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-[9px] border border-neutral-300 px-2.5 py-1.5 text-[17px] font-semibold text-neutral-900"
            />
          ) : (
            <p className="mt-0.5 text-[17px] font-semibold text-neutral-900">
              {proposal.field === "areas_of_interest" ? <span className="text-brand-600">{proposed}</span> : proposed}{" "}
              <span className="text-[15px] font-normal text-neutral-500">{meta}</span>
            </p>
          )}
          <p className="mt-1.5 text-[15px] leading-[22px] text-neutral-600">
            {proposal.speaker && <span className="font-semibold">{proposal.speaker}: </span>}
            &ldquo;{proposal.quote}&rdquo;
            {timestampLabel && <span className="text-neutral-400"> ({timestampLabel})</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isEditableText && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500">
              <Pencil size={14} />
            </button>
          )}
          {editing && (
            <button type="button" onClick={handleAccept} disabled={busy} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500 disabled:opacity-50">
              <Check size={14} />
            </button>
          )}
          <button type="button" onClick={handleReject} disabled={busy} className="rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500 disabled:opacity-50">
            <X size={14} />
          </button>
        </div>
      </div>
      {!editing && (
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy}
          className="mt-2.5 rounded-[9px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Keep this"}
        </button>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-600">Couldn&apos;t save: {error} - try again.</p>}
    </div>
  );
}
