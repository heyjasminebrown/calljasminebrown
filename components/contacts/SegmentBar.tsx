"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { Plus, X } from "lucide-react";
import type { ContactSegment } from "@/types/database";

export function SegmentBar({ segments, ownerId }: { segments: ContactSegment[]; ownerId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const hasActiveFilters = searchParams.toString().length > 0;

  async function saveSegment() {
    if (!name.trim()) return;
    const filters = Object.fromEntries(searchParams.entries());
    const supabase = createClient();
    await supabase.from("contact_segments").insert({ owner_id: ownerId, name: name.trim(), filters });
    setName("");
    setSaving(false);
    router.refresh();
  }

  async function deleteSegment(id: string) {
    const supabase = createClient();
    await supabase.from("contact_segments").delete().eq("id", id);
    router.refresh();
  }

  function applySegment(seg: ContactSegment) {
    const params = new URLSearchParams(seg.filters as Record<string, string>);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (segments.length === 0 && !hasActiveFilters && !saving) {
    return (
      <div className="border-b border-neutral-100 bg-white px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-neutral-400">Lists</p>
        <p className="mt-1 text-xs text-neutral-400">Filter the table, then save this view as a list.</p>
      </div>
    );
  }

  return (
    <div className="border-b border-neutral-100 bg-white px-4 py-2.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.08em] text-neutral-400">Lists</p>
      <div className="flex flex-wrap items-center gap-2">
      {segments.map((seg) => (
        <span
          key={seg.id}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1.5 text-xs font-medium text-neutral-600"
        >
          <button onClick={() => applySegment(seg)} className="hover:text-brand-700">
            {seg.name}
          </button>
          <button onClick={() => deleteSegment(seg.id)} className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-red-600">
            <X size={11} />
          </button>
        </span>
      ))}

      {saving ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            className="w-36 py-1.5 text-xs"
          />
          <Button size="sm" onClick={saveSegment} disabled={!name.trim()}>
            Save
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSaving(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        hasActiveFilters && (
          <button
            onClick={() => setSaving(true)}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            <Plus size={12} /> Save this view as a list
          </button>
        )
      )}
      </div>
    </div>
  );
}
