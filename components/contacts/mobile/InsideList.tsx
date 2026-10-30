"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Tag, KanbanSquare, Mail } from "lucide-react";
import { Avatar } from "@/components/ui";
import { TextBlastModal } from "@/components/contacts/TextBlastModal";
import { BulkTagModal } from "@/components/contacts/BulkTagModal";
import { BulkStageModal } from "@/components/contacts/BulkStageModal";
import { BulkSequenceModal } from "@/components/contacts/BulkSequenceModal";
import { cn } from "@/lib/utils";
import type { ContactWithRelations, PipelineStage, Tag as TagType } from "@/types/database";

type SequenceOption = { id: string; name: string; type: string };

// A simpler "who can I actually text" split than the design spec's full
// checked-in/no-showed attendance breakdown - that needs real per-event
// attendance data (a join this screen doesn't have yet) to be honest
// rather than approximate, so it's deliberately left for later. Textable
// = has a phone and hasn't opted out; that's real data, available now.
export function InsideList({
  listName,
  contacts,
  stages,
  tags,
  sequences,
  ownerId,
  backHref,
}: {
  listName: string;
  contacts: ContactWithRelations[];
  stages: PipelineStage[];
  tags: TagType[];
  sequences: SequenceOption[];
  ownerId: string;
  backHref: string;
}) {
  const router = useRouter();
  const textable = contacts.filter((c) => c.phone && !c.opted_out_at);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(textable.map((c) => c.id)));
  const [showAll, setShowAll] = useState(false);
  const [blastOpen, setBlastOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);

  const visible = showAll ? contacts : textable;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedContacts = contacts.filter((c) => selected.has(c.id));

  return (
    <div className="pb-8">
      <button type="button" onClick={() => router.push(backHref)} className="mb-2 flex items-center gap-1.5 text-[15px] font-medium text-neutral-600">
        <ChevronLeft size={17} /> My lists
      </button>
      <p className="font-serif text-[19px] font-semibold text-neutral-900">{listName}</p>
      <p className="mt-0.5 text-[14px] text-neutral-500">
        {contacts.length} in this saved list · {textable.length} textable
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={cn("h-11 rounded-full px-3.5 text-[14px] font-medium", !showAll ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600")}
        >
          Textable {textable.length}
        </button>
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={cn("h-11 rounded-full px-3.5 text-[14px] font-medium", showAll ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600")}
        >
          All {contacts.length}
        </button>
      </div>

      <div className="mt-3 rounded-[16px] border border-[#ebe9e7] bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-100 px-4 py-2">
          <span className="text-[13px] font-semibold text-neutral-700">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => setSelected(new Set(textable.map((c) => c.id)))}
            className="text-[13px] font-medium text-brand-600"
          >
            All textable
          </button>
        </div>
        <div className="divide-y divide-neutral-100">
          {visible.map((contact) => {
            const canText = !!contact.phone && !contact.opted_out_at;
            const name = `${contact.first_name} ${contact.last_name}`.trim();
            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => canText && toggle(contact.id)}
                disabled={!canText}
                className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
              >
                <span
                  className={cn(
                    "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border-2",
                    selected.has(contact.id) ? "border-brand-600 bg-brand-600" : "border-neutral-300",
                  )}
                >
                  {selected.has(contact.id) && <span className="h-2.5 w-2.5 rounded-sm bg-white" />}
                </span>
                <Avatar firstName={contact.first_name} lastName={contact.last_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[16px] font-semibold", canText ? "text-neutral-900" : "text-neutral-500")}>{name}</p>
                  {!canText && (
                    <p className="text-[13px] text-neutral-400">{contact.opted_out_at ? "Opted out of texts" : "Email only · can't be texted"}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-[16px] bg-neutral-900 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[.09em] text-white/50">Text {selected.size} people</p>
        <p className="mt-2 text-[15px] text-white/80">Send a message to everyone selected above - sends individually from your Quo number.</p>
        <button
          type="button"
          onClick={() => setBlastOpen(true)}
          disabled={selected.size === 0}
          className="mt-3 h-[52px] w-full rounded-xl bg-white text-[15px] font-semibold text-neutral-900 disabled:opacity-50"
        >
          Compose
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setTagOpen(true)}
          disabled={selected.size === 0}
          className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 text-[12px] font-medium text-neutral-700 disabled:opacity-50"
        >
          <Tag size={17} /> Add tag
        </button>
        <button
          type="button"
          onClick={() => setStageOpen(true)}
          disabled={selected.size === 0}
          className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 text-[12px] font-medium text-neutral-700 disabled:opacity-50"
        >
          <KanbanSquare size={17} /> Stage
        </button>
        <button
          type="button"
          onClick={() => setSequenceOpen(true)}
          disabled={selected.size === 0}
          className="flex h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200 text-[12px] font-medium text-neutral-700 disabled:opacity-50"
        >
          <Mail size={17} /> Sequence
        </button>
      </div>

      {blastOpen && (
        <TextBlastModal target={{ kind: "contacts", contactIds: [...selected], label: listName }} onClose={() => setBlastOpen(false)} />
      )}
      {tagOpen && <BulkTagModal mode="add" tags={tags} contactIds={[...selected]} onClose={() => setTagOpen(false)} onDone={() => router.refresh()} />}
      {stageOpen && (
        <BulkStageModal contacts={selectedContacts} stages={stages} ownerId={ownerId} onClose={() => setStageOpen(false)} onDone={() => router.refresh()} />
      )}
      {sequenceOpen && (
        <BulkSequenceModal sequences={sequences} contactIds={[...selected]} onClose={() => setSequenceOpen(false)} onDone={() => router.refresh()} />
      )}
    </div>
  );
}
