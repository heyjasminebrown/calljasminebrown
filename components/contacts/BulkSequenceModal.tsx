"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Select } from "@/components/ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SequenceOption = { id: string; name: string };
type BulkSequenceMode = "add" | "pause" | "resume" | "remove";

const MODE_OPTIONS: { value: BulkSequenceMode; label: string }[] = [
  { value: "add", label: "Add to" },
  { value: "pause", label: "Pause in" },
  { value: "resume", label: "Resume in" },
  { value: "remove", label: "Remove from" },
];

const VERB: Record<BulkSequenceMode, string> = { add: "Add to sequence", pause: "Pause", resume: "Resume", remove: "Remove from sequence" };
const VERBING: Record<BulkSequenceMode, string> = { add: "Enrolling…", pause: "Pausing…", resume: "Resuming…", remove: "Removing…" };

export function BulkSequenceModal({
  sequences,
  contactIds,
  onClose,
  onDone,
}: {
  sequences: SequenceOption[];
  contactIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<BulkSequenceMode>("add");
  const [sequenceId, setSequenceId] = useState(sequences[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!sequenceId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: applyError } =
      mode === "add"
        ? // ignoreDuplicates so an already-enrolled contact isn't reset back
          // to step 1 - this is a backfill tool, not a re-enroll tool.
          await supabase.from("email_sequence_enrollments").upsert(
            contactIds.map((contact_id) => ({ sequence_id: sequenceId, contact_id })),
            { onConflict: "sequence_id,contact_id", ignoreDuplicates: true },
          )
        : mode === "remove"
          ? await supabase.from("email_sequence_enrollments").delete().eq("sequence_id", sequenceId).in("contact_id", contactIds)
          : await supabase
              .from("email_sequence_enrollments")
              .update({ status: mode === "pause" ? "paused" : "active" })
              .eq("sequence_id", sequenceId)
              .in("contact_id", contactIds);

    setSaving(false);
    if (applyError) {
      setError(applyError.message);
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">Sequence</p>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        {sequences.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No drip sequences yet. Only drip sequences support manual enrollment — a broadcast (scheduled) sequence already sends to
            whoever currently has its target tag, no enrollment needed.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {MODE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setMode(o.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium",
                    mode === o.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-sm text-neutral-500">
              {mode === "add" &&
                `Enrolling ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"}. Everyone starts at step 1 — already-enrolled contacts are left where they are.`}
              {mode === "pause" &&
                `Pausing ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} — they'll stay at their current step until resumed.`}
              {mode === "resume" && `Resuming ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"}.`}
              {mode === "remove" &&
                `Removing ${contactIds.length} contact${contactIds.length === 1 ? "" : "s"} entirely — their send history stays on record.`}
            </p>

            <div className="mt-3">
              <Select value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}>
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">Couldn&apos;t save: {error}</p>}
            <div className="mt-5 flex gap-3">
              <Button onClick={apply} disabled={saving || !sequenceId} className="flex-1">
                {saving ? VERBING[mode] : VERB[mode]}
              </Button>
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
