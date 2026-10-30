"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Select, Textarea } from "@/components/ui";
import { Plus } from "lucide-react";
import type { ActivityType, ActivityDirection } from "@/types/database";

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "showing", label: "Showing" },
  { value: "note", label: "Note" },
];

export function AddActivityForm({ contactId, ownerId }: { contactId: string; ownerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("note");
  const [direction, setDirection] = useState<ActivityDirection>("none");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && type === "note") return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("activities").insert({
      owner_id: ownerId,
      contact_id: contactId,
      type,
      direction: type === "note" || type === "meeting" || type === "showing" ? "none" : direction,
      body: body.trim() || null,
      source: "manual",
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setBody("");
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="w-full">
        <Plus size={16} /> Log activity
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-neutral-200 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {(type === "call" || type === "text" || type === "email") && (
          <Select value={direction} onChange={(e) => setDirection(e.target.value as ActivityDirection)}>
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </Select>
        )}
      </div>
      <Textarea
        rows={3}
        placeholder="What happened?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
