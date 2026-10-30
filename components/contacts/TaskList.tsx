"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLocal, dateInputToAppIso, isoToDateInput } from "@/lib/format-time";
import { Pencil, Trash2, Check, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { snoozeTask } from "@/app/(app)/today-actions";
import { SnoozeMenu } from "@/components/contacts/SnoozeMenu";
import type { Task } from "@/types/database";

export function TaskList({ contactId, ownerId, tasks }: { contactId: string; ownerId: string; tasks: Task[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase.from("tasks").insert({
      owner_id: ownerId,
      contact_id: contactId,
      title: title.trim(),
      due_at: dueAt ? dateInputToAppIso(dueAt) : null,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setTitle("");
    setDueAt("");
    setSaving(false);
    setAdding(false);
    router.refresh();
  }

  async function toggleComplete(task: Task) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update({ completed_at: task.completed_at ? null : new Date().toISOString() }).eq("id", task.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDueAt(isoToDateInput(task.due_at));
  }

  async function saveEdit(taskId: string) {
    if (!editTitle.trim()) return;
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ title: editTitle.trim(), due_at: editDueAt ? dateInputToAppIso(editDueAt) : null })
      .eq("id", taskId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function snooze(taskId: string, days: number) {
    setSnoozeId(null);
    const res = await snoozeTask(taskId, days);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setConfirmingDeleteId(null);
    router.refresh();
  }

  return (
    <div>
      {error && <p className="px-[18px] pt-3 text-sm text-red-600">{error}</p>}
      {tasks.map((task) => (
        <div key={task.id} className="border-b border-neutral-100 px-[18px] py-3.5 last:border-b-0">
          {editingId === task.id ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[15px] text-neutral-900"
              />
              <input
                type="date"
                value={editDueAt}
                onChange={(e) => setEditDueAt(e.target.value)}
                className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm text-neutral-700"
              />
              <button onClick={() => saveEdit(task.id)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500">
                Cancel
              </button>
            </div>
          ) : confirmingDeleteId === task.id ? (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[15px] text-neutral-600">Delete &ldquo;{task.title}&rdquo;?</p>
              <button onClick={() => deleteTask(task.id)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">
                Delete
              </button>
              <button onClick={() => setConfirmingDeleteId(null)} className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3.5">
              <button
                onClick={() => toggleComplete(task)}
                className={cn(
                  "flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full border",
                  task.completed_at ? "border-neutral-400 bg-neutral-400 text-white" : "border-neutral-300",
                )}
              >
                {task.completed_at && <Check size={13} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-base font-medium", task.completed_at ? "text-neutral-400 line-through" : "text-neutral-900")}>
                  {task.title}
                </p>
                {task.due_at && (
                  <p className="text-sm text-neutral-500">{task.completed_at ? "Done " : "Due "}{formatLocal(task.due_at, "MMM d")}</p>
                )}
              </div>
              {!task.completed_at && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSnoozeId(snoozeId === task.id ? null : task.id)}
                    className="shrink-0 rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500"
                    aria-label="Snooze task"
                  >
                    <Clock size={14} />
                  </button>
                  {snoozeId === task.id && <SnoozeMenu onPick={(days) => snooze(task.id, days)} />}
                </div>
              )}
              <button onClick={() => startEdit(task)} className="shrink-0 rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500">
                <Pencil size={14} />
              </button>
              <button onClick={() => setConfirmingDeleteId(task.id)} className="shrink-0 rounded-[10px] border border-neutral-200 bg-white p-2 text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="p-[18px]">
        {adding ? (
          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="min-w-0 flex-1 rounded-[10px] border border-neutral-200 px-3 py-2 text-[15px] text-neutral-900"
            />
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-[10px] border border-neutral-200 px-3 py-2 text-sm text-neutral-700"
            />
            <button type="submit" disabled={saving || !title.trim()} className="rounded-[10px] bg-neutral-900 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : "Add"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-[10px] px-2.5 py-2 text-sm text-neutral-500">
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-[15px] font-medium text-neutral-500"
          >
            <Plus size={16} /> Add a task
          </button>
        )}
      </div>
    </div>
  );
}
