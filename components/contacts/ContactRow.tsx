"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Phone, MessageSquareText, MoreHorizontal, PhoneOff, Plus, ChevronRight as ArrowRight } from "lucide-react";
import { fullName, formatPhone, initials, CONTACT_TYPE_LABELS, TIMELINE_LABELS } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { openQuoCall } from "@/lib/quo/call-link";
import { StageSelector } from "@/components/contacts/StageSelector";
import { SendTextForm } from "@/components/contacts/SendTextForm";
import { SendEmailForm } from "@/components/contacts/SendEmailForm";
import { Select } from "@/components/ui";
import { dateInputToAppIso, isoToDateInput } from "@/lib/format-time";
import type { ContactWithRelations, PipelineStage } from "@/types/database";

export function ContactRow({
  contact,
  stages,
  ownerId,
  selecting = false,
  selected = false,
  onToggle,
  lastActivityLabel,
}: {
  contact: ContactWithRelations;
  stages: PipelineStage[];
  ownerId: string;
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  lastActivityLabel?: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [quickTextOpen, setQuickTextOpen] = useState(false);
  const [quickEmailOpen, setQuickEmailOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [followUpAt, setFollowUpAt] = useState(isoToDateInput(contact.next_follow_up_at));
  const [timeline, setTimeline] = useState(contact.timeline);
  const [phoneDraft, setPhoneDraft] = useState(contact.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const hasPhone = !!contact.phone;

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneDraft.trim()) return;
    setSavingPhone(true);
    setRowError(null);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({ phone: phoneDraft.trim() }).eq("id", contact.id);
    setSavingPhone(false);
    if (error) {
      setRowError(error.message);
      return;
    }
    router.refresh();
  }
  const meta = hasPhone
    ? [CONTACT_TYPE_LABELS[contact.contact_type], formatPhone(contact.phone), lastActivityLabel].filter(Boolean).join(" · ")
    : null;

  // Local state is only flipped after the write succeeds - previously it
  // updated immediately, so a denied/failed write left the input showing
  // the new value while the contact's real record never changed.
  async function saveFollowUp(value: string) {
    setRowError(null);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({ next_follow_up_at: value ? dateInputToAppIso(value) : null }).eq("id", contact.id);
    if (error) {
      setRowError(error.message);
      return;
    }
    setFollowUpAt(value);
    router.refresh();
  }

  async function saveTimeline(value: string) {
    setRowError(null);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({ timeline: value }).eq("id", contact.id);
    if (error) {
      setRowError(error.message);
      return;
    }
    setTimeline(value as typeof contact.timeline);
    router.refresh();
  }

  // Same action toggles both ways - archiving had no undo anywhere in the
  // app, so viewing the archived list (?archived=archived) via the People
  // filters left no way back short of editing the row by hand.
  async function toggleArchive() {
    setRowError(null);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").update({ archived: !contact.archived }).eq("id", contact.id);
    if (error) {
      setRowError(error.message);
      return;
    }
    router.refresh();
  }

  if (selecting) {
    return (
      <div
        className="flex items-center gap-3.5 border-b border-neutral-100 px-4 py-3.5"
        role="button"
        tabIndex={0}
        onClick={onToggle}
      >
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0 rounded border-neutral-300" />
        <RowIdentity contact={contact} meta={meta} />
      </div>
    );
  }

  return (
    <div className={hasPhone ? "bg-white" : "bg-[#fcfbfa]"}>
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="shrink-0 text-neutral-400">
          {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </button>

        <Link href={`/contacts/${contact.id}`} data-contact-open={contact.id} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-[12px] px-1 py-0.5 hover:bg-[#f7f1ea]">
          <RowIdentity contact={contact} meta={meta} noPhoneBg={!hasPhone} />
          <ChevronRight size={18} className="shrink-0 text-neutral-300" />
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {hasPhone ? (
            <>
              <button
                type="button"
                onClick={() => openQuoCall(contact.phone!)}
                className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
              >
                <Phone size={15} className="text-neutral-500" /> Call
              </button>
              <button
                type="button"
                onClick={() => setQuickTextOpen((v) => !v)}
                className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-semibold ${quickTextOpen ? "border-brand-300 bg-brand-50 text-brand-700" : "border-neutral-200 bg-white text-neutral-800"}`}
              >
                <MessageSquareText size={15} className={quickTextOpen ? "text-brand-600" : "text-neutral-500"} /> Text
              </button>
            </>
          ) : (
            <>
              {contact.email && (
                <button
                  type="button"
                  onClick={() => setQuickEmailOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-sm font-semibold ${quickEmailOpen ? "border-brand-300 bg-brand-50 text-brand-700" : "border-neutral-200 bg-white text-neutral-800"}`}
                >
                  Email
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1.5 rounded-[10px] border border-dashed border-neutral-300 bg-transparent px-3 py-2 text-sm font-semibold text-neutral-500"
              >
                <Plus size={15} /> Add number
              </button>
            </>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center rounded-[10px] border border-neutral-200 bg-white p-2 text-neutral-500"
            >
              <MoreHorizontal size={15} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                {contact.archived ? (
                  <button
                    onClick={toggleArchive}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    Restore
                  </button>
                ) : confirmingArchive ? (
                  <div className="space-y-1 p-1.5">
                    <p className="text-xs text-neutral-600">{rowError ? `Couldn't archive: ${rowError}` : "Archive contact?"}</p>
                    <div className="flex gap-1.5">
                      <button onClick={toggleArchive} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white">
                        Confirm
                      </button>
                      <button onClick={() => setConfirmingArchive(false)} className="rounded-lg px-2 py-1 text-xs text-neutral-500">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingArchive(true)}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {quickTextOpen && hasPhone && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5">
          <SendTextForm contactId={contact.id} phone={contact.phone} firstName={contact.first_name} lastName={contact.last_name} />
        </div>
      )}

      {quickEmailOpen && !hasPhone && contact.email && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5">
          <SendEmailForm contactId={contact.id} email={contact.email} />
        </div>
      )}

      {expanded && (
        <div className="border-t border-neutral-100 bg-[#fcfbfa] p-[18px]">
          {rowError && <p className="mb-3 text-sm font-medium text-red-600">Couldn&apos;t save: {rowError}</p>}
          {!hasPhone && (
            <form onSubmit={savePhone} className="mb-4 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-500">Phone</p>
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder="(404) 555-0188"
                  className="mt-1.5 w-full rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-900"
                />
              </div>
              <button
                type="submit"
                disabled={savingPhone || !phoneDraft.trim()}
                className="shrink-0 rounded-[10px] bg-neutral-900 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingPhone ? "Saving…" : "Save"}
              </button>
            </form>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-neutral-500">Stage</p>
              <div className="mt-1.5">
                <StageSelector contactId={contact.id} ownerId={ownerId} currentStageId={contact.stage_id} stages={stages} contactName={fullName(contact)} contactCreatedAt={contact.created_at} representing={contact.representing} />
              </div>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Next follow-up</p>
              <input
                type="date"
                value={followUpAt}
                onChange={(e) => saveFollowUp(e.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-900"
              />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Timeline</p>
              <Select value={timeline} onChange={(e) => saveTimeline(e.target.value)} className="mt-1.5">
                {Object.entries(TIMELINE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="mt-4 text-[15px] leading-[23px] text-neutral-700">
            {[CONTACT_TYPE_LABELS[contact.contact_type], contact.representing ? `${contact.representing} side` : null].filter(Boolean).join(" · ")}
            {contact.notes ? ` — ${contact.notes}` : ""}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {contact.contact_tags
              .filter((ct) => ct.tags)
              .map((ct) => (
                <span key={ct.tags!.id} className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700">
                  {ct.tags!.name}
                </span>
              ))}
            <Link href={`/contacts/${contact.id}`} className="ml-auto flex items-center gap-1.5 text-[15px] font-semibold text-neutral-900">
              Open full record <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function RowIdentity({ contact, meta, noPhoneBg }: { contact: ContactWithRelations; meta: string | null; noPhoneBg?: boolean }) {
  return (
    <>
      <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold ${noPhoneBg ? "bg-[#f0efee] text-neutral-400" : "bg-neutral-100 text-neutral-600"}`}>
        {initials(contact.first_name, contact.last_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold leading-6 text-neutral-900">{fullName(contact)}</p>
        {meta ? (
          <p className="truncate text-[15px] leading-[22px] text-neutral-600">{meta}</p>
        ) : (
          <p className="flex items-center gap-1.5 truncate text-[15px] leading-[22px] text-neutral-500">
            <PhoneOff size={15} className="shrink-0 text-neutral-400" /> No phone number · email only
          </p>
        )}
      </div>
    </>
  );
}
