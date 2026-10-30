"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Select } from "@/components/ui";
import { dateInputToAppIso } from "@/lib/format-time";

type ContactOption = { id: string; first_name: string; last_name: string };

// Shared by the sidebar's "Quick add" button and the mobile FAB - today the
// app only ever quick-adds a contact; this adds a task as the second
// option, since a task doesn't have to be about anyone (contact_id is
// nullable) and shouldn't require detouring through a specific contact's
// page just to jot one down.
export function QuickAddMenu({
  onClose,
  initialMode = "pick",
  initialContactId,
}: {
  onClose: () => void;
  initialMode?: "pick" | "task";
  initialContactId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"pick" | "task">(initialMode);
  const [contacts, setContacts] = useState<ContactOption[] | null>(null);
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState(initialContactId ?? "");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "task" || contacts) return;
    const supabase = createClient();
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("archived", false)
      .order("first_name")
      .then(({ data }) => setContacts((data ?? []) as ContactOption[]));
  }, [mode, contacts]);

  async function addContact() {
    router.push("/contacts/new");
    onClose();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session expired. Please sign in again.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("tasks").insert({
      owner_id: user.id,
      contact_id: contactId || null,
      title: title.trim(),
      due_at: dueAt ? dateInputToAppIso(dueAt) : null,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-serif text-xl font-semibold text-neutral-900">Quick add</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-2">
            <button
              onClick={addContact}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50"
            >
              <UserPlus size={20} className="text-neutral-500" />
              <div>
                <p className="text-base font-semibold text-neutral-900">New contact</p>
                <p className="text-sm text-neutral-500">Add someone new to the CRM</p>
              </div>
            </button>
            <button
              onClick={() => setMode("task")}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-4 text-left hover:border-brand-300 hover:bg-brand-50"
            >
              <ListTodo size={20} className="text-neutral-500" />
              <div>
                <p className="text-base font-semibold text-neutral-900">New task</p>
                <p className="text-sm text-neutral-500">About someone, or nothing in particular</p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={addTask} className="space-y-3">
            <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">No contact</option>
                {contacts?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </Select>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving || !title.trim()} className="flex-1">
                {saving ? "Adding…" : "Add task"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("pick")}>
                Back
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
