"use client";

import { useState } from "react";
import { formatLocal } from "@/lib/format-time";
import {
  Phone,
  MessageSquare,
  Mail,
  StickyNote,
  Users,
  Home,
  ArrowRightCircle,
  CheckCircle2,
  Bot,
  ArrowDownLeft,
  ArrowUpRight,
  PlayCircle,
} from "lucide-react";
import type { Activity } from "@/types/database";

const ICONS: Record<string, typeof Phone> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  note: StickyNote,
  meeting: Users,
  showing: Home,
  status_change: ArrowRightCircle,
  task_completed: CheckCircle2,
  system: Bot,
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "",
  quo: "Quo",
  gmail: "Gmail",
  calendly: "Calendly",
  eventbrite: "Eventbrite",
  jotform: "Jotform",
  granola: "Granola",
  listing_page: "Listing",
  ai: "AI",
  system: "System",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "call", label: "Calls" },
  { value: "text", label: "Texts" },
  { value: "email", label: "Emails" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
] as const;

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

const PAGE_SIZE = 8;

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = filter === "all" ? activities : activities.filter((a) => a.type === filter);
  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 px-[18px] py-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === f.value ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="px-[18px] pb-5 text-[15px] text-neutral-400">Nothing here yet.</p>
      ) : (
        <div className="px-[18px] pb-3">
          {visible.map((a) => {
            const Icon = ICONS[a.type] ?? StickyNote;
            const sourceLabel = SOURCE_LABELS[a.source];
            const recordingUrl = asString(a.metadata?.recording_url);
            const transcript = asString(a.metadata?.transcript);

            return (
              <div key={a.id} className="flex gap-3.5 border-b border-neutral-100 py-4 last:border-b-0">
                <div className="mt-0.5 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                    <span>{formatLocal(a.occurred_at, "MMM d · h:mm a")}</span>
                    {a.direction === "inbound" && <ArrowDownLeft size={12} />}
                    {a.direction === "outbound" && <ArrowUpRight size={12} />}
                    {sourceLabel && <span>· {sourceLabel}</span>}
                  </div>
                  {a.body && <p className="mt-1 whitespace-pre-wrap text-base leading-6 text-neutral-700">{a.body}</p>}

                  {recordingUrl && (
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900"
                    >
                      <PlayCircle size={14} /> Recording
                    </a>
                  )}

                  {transcript && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-neutral-900">Transcript</summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">{transcript}</p>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!expanded && filtered.length > PAGE_SIZE && (
        <div className="border-t border-neutral-100 px-[18px] py-3">
          <button onClick={() => setExpanded(true)} className="text-[15px] font-semibold text-neutral-900">
            Show all {filtered.length}
          </button>
        </div>
      )}
    </div>
  );
}
