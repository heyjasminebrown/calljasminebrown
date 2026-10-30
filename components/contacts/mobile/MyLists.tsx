"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Globe, Bookmark, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import type { ContactWithRelations, ContactSegment } from "@/types/database";
import { REGISTERED_FOR_ANY_EVENT } from "@/lib/crm/contact-filter-params";

function Tile({ icon: Icon, label, meta, onClick }: { icon: React.ComponentType<{ size?: number }>; label: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-neutral-100 py-3 text-left last:border-b-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-neutral-100 text-neutral-500">
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-neutral-900">{label}</p>
        <p className="truncate text-[14px] text-neutral-500">{meta}</p>
      </div>
    </button>
  );
}

export function MyLists({
  contacts,
  eventNames,
  registeredEventNames = [],
  leadSources,
  segments,
}: {
  contacts: ContactWithRelations[];
  eventNames: string[];
  registeredEventNames?: string[];
  leadSources: string[];
  segments: ContactSegment[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sorted = [...segments].sort((a, b) => a.sort_order - b.sort_order);

  function goto(param: string, value: string, label: string) {
    router.push(`/contacts?${param}=${encodeURIComponent(value)}&view=my-lists&list=${encodeURIComponent(label)}`);
  }

  function applySegment(seg: ContactSegment) {
    const params = new URLSearchParams(seg.filters as Record<string, string>);
    params.set("view", "my-lists");
    params.set("list", seg.name);
    router.push(`/contacts?${params.toString()}`);
  }

  async function renameSegment(seg: ContactSegment) {
    const name = window.prompt("Rename this list", seg.name);
    if (!name || !name.trim() || name.trim() === seg.name) return;
    setError(null);
    const supabase = createClient();
    const { error: renameError } = await supabase.from("contact_segments").update({ name: name.trim() }).eq("id", seg.id);
    if (renameError) {
      setError(renameError.message);
      return;
    }
    router.refresh();
  }

  async function deleteSegment(seg: ContactSegment) {
    if (!confirm(`Delete "${seg.name}"?`)) return;
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("contact_segments").delete().eq("id", seg.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  async function moveSegment(index: number, direction: -1 | 1) {
    const target = sorted[index + direction];
    const current = sorted[index];
    if (!target) return;
    setError(null);
    const supabase = createClient();
    const results = await Promise.all([
      supabase.from("contact_segments").update({ sort_order: target.sort_order }).eq("id", current.id),
      supabase.from("contact_segments").update({ sort_order: current.sort_order }).eq("id", target.id),
    ]);
    const moveError = results.find((r) => r.error)?.error;
    if (moveError) {
      setError(moveError.message);
      return;
    }
    router.refresh();
  }

  const attendedEvents = eventNames.filter((name) => contacts.some((c) => c.last_event_name === name));
  const usedSources = leadSources.filter((source) => contacts.some((c) => c.lead_source === source));
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const metThisMonth = contacts.filter((c) => c.lead_date && new Date(c.lead_date) >= monthAgo).length;

  return (
    <div className="space-y-4">
      {error && <p className="px-1 text-[14px] font-medium text-red-600">Couldn&apos;t save: {error}</p>}
      {sorted.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Your lists</p>
          <div className="rounded-[16px] border border-[#ebe9e7] bg-white px-3">
            {sorted.map((seg, i) => (
              <div key={seg.id} className="flex items-center gap-2 border-b border-neutral-100 py-2.5 last:border-b-0">
                <button type="button" onClick={() => applySegment(seg)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-neutral-100 text-neutral-500">
                    <Bookmark size={18} />
                  </div>
                  <p className="truncate text-[16px] font-semibold text-neutral-900">{seg.name}</p>
                </button>
                <button type="button" onClick={() => renameSegment(seg)} className="rounded-lg p-2 text-[13px] font-medium text-neutral-400">
                  Rename
                </button>
                <button type="button" onClick={() => moveSegment(i, -1)} disabled={i === 0} className="rounded-lg p-2 text-neutral-400 disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveSegment(i, 1)}
                  disabled={i === sorted.length - 1}
                  className="rounded-lg p-2 text-neutral-400 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button type="button" onClick={() => deleteSegment(seg)} className="rounded-lg p-2 text-neutral-400">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Where you met</p>
        <div className="rounded-[16px] border border-[#ebe9e7] bg-white px-4">
          {attendedEvents.length === 0 ? (
            <p className="py-4 text-center text-[15px] text-neutral-400">No events yet.</p>
          ) : (
            attendedEvents.map((name) => (
              <Tile
                key={name}
                icon={Calendar}
                label={name}
                meta={`${contacts.filter((c) => c.last_event_name === name).length} people`}
                onClick={() => goto("event", name, name)}
              />
            ))
          )}
        </div>
      </div>

      <div>
          <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">Registered for</p>
          <div className="rounded-[16px] border border-[#ebe9e7] bg-white px-4">
            <Tile
              icon={Calendar}
              label="Any event"
              meta="Eventbrite / CRM event signups"
              onClick={() => goto("regEvent", REGISTERED_FOR_ANY_EVENT, "Registered: any event")}
            />
            {registeredEventNames.map((name) => (
              <Tile
                key={name}
                icon={Calendar}
                label={name}
                meta="Eventbrite registrations"
                onClick={() => goto("regEvent", name, `Registered: ${name}`)}
              />
            ))}
          </div>
        </div>

      <div>
        <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">How they found you</p>
        <div className="rounded-[16px] border border-[#ebe9e7] bg-white px-4">
          {usedSources.length === 0 ? (
            <p className="py-4 text-center text-[15px] text-neutral-400">No sources yet.</p>
          ) : (
            usedSources.map((source) => (
              <Tile
                key={source}
                icon={Globe}
                label={source}
                meta={`${contacts.filter((c) => c.lead_source === source).length} people`}
                onClick={() => goto("source", source, source)}
              />
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-[.05em] text-neutral-400">When you met</p>
        <div className="rounded-[16px] border border-[#ebe9e7] bg-white px-4">
          <Tile icon={Calendar} label="Met this month" meta={`${metThisMonth} people`} onClick={() => goto("newSince", "30", "Met this month")} />
        </div>
      </div>
    </div>
  );
}
