"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { Trash2, Plus } from "lucide-react";
import type { Tag } from "@/types/database";

export function TagManager({ tags, ownerId }: { tags: Tag[]; ownerId: string }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateTag(id: string, patch: Partial<Tag>) {
    const supabase = createClient();
    await supabase.from("tags").update(patch).eq("id", id);
    router.refresh();
  }

  async function deleteTag(id: string) {
    if (!confirm("Delete this tag? It will be removed from any contacts that have it.")) return;
    const supabase = createClient();
    await supabase.from("tags").delete().eq("id", id);
    router.refresh();
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("tags").insert({ owner_id: ownerId, name: newName.trim(), color: "#94a3b8" });
    if (!error) setNewName("");
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-[16px] font-semibold text-neutral-900">Tags</p>
      <div className="mt-3 space-y-2.5">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-2.5">
            <input
              type="color"
              value={tag.color}
              onChange={(e) => updateTag(tag.id, { color: e.target.value })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-neutral-200"
            />
            <Input
              defaultValue={tag.name}
              onBlur={(e) => e.target.value !== tag.name && updateTag(tag.id, { name: e.target.value })}
              className="flex-1 font-medium"
            />
            <button onClick={() => deleteTag(tag.id)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={addTag} className="mt-3 flex gap-2">
        <Input placeholder="New tag name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Button type="submit" size="sm" disabled={saving}>
          <Plus size={15} /> Add
        </Button>
      </form>
    </div>
  );
}
