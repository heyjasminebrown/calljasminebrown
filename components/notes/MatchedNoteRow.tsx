import Link from "next/link";
import { relativeTime } from "@/lib/format-time";
import type { MatchedNote } from "@/lib/data/notes-inbox";

export function MatchedNoteRow({ note }: { note: MatchedNote }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium text-neutral-900">{note.contactName}</p>
        <p className="text-sm text-neutral-500">
          {relativeTime(note.occurredAt)} · {note.pendingCount} proposed change{note.pendingCount === 1 ? "" : "s"}
        </p>
      </div>
      <Link href={`/contacts/${note.contactId}`} className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800">
        Review
      </Link>
    </div>
  );
}
