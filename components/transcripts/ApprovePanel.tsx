"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { applyStageChange, type DealModalMode, type PendingDealSummary } from "@/lib/crm/stage-transition";
import { DealCelebrationModal } from "@/components/contacts/DealCelebrationModal";
import { PendingDealCleanupModal } from "@/components/contacts/PendingDealCleanupModal";
import { ApproveRow } from "@/components/transcripts/ApproveRow";
import { sendEmailToContact } from "@/app/(app)/contacts/actions";
import { relativeTime } from "@/lib/format-time";
import { initials } from "@/lib/utils";
import type { MeetingTranscript, ProposedChange, PipelineStage, Representing, DealSide } from "@/types/database";

// "memo" has no live source wired to it - Granola covers the voice-memo
// case too (its phone app captures in-person and phone calls), so every
// non-Quo transcript comes through as "granola" regardless of whether it
// was a video meeting, a coffee, or a quick phone note.
const SOURCE_LABEL: Record<MeetingTranscript["source"], string> = {
  quo: "Call",
  tactiq: "Meeting",
  granola: "Granola note",
  memo: "Voice memo",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ApprovePanel({
  transcript,
  proposals: initialProposals,
  contactId,
  contactName,
  ownerId,
  contactStageId,
  contactCreatedAt,
  representing,
  stages,
}: {
  transcript: MeetingTranscript;
  proposals: ProposedChange[];
  contactId: string;
  contactName: string;
  ownerId: string;
  contactStageId: string | null;
  contactCreatedAt: string;
  representing: Representing | null;
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [dealModal, setDealModal] = useState<{ id: string; mode: DealModalMode } | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<PendingDealSummary[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveAllError, setSaveAllError] = useState<string | null>(null);
  const [participants, setParticipants] = useState(transcript.participants ?? []);
  const [addingContact, setAddingContact] = useState<number | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapBody, setRecapBody] = useState(
    () => `Hey! Thanks for the time today${transcript.summary_bullets[0] ? ` - ${transcript.summary_bullets[0]}` : ""}. Let me know if anything comes up.`,
  );
  const [recapSending, setRecapSending] = useState(false);
  const [recapSent, setRecapSent] = useState(false);

  const firstName = contactName.split(" ")[0] || contactName;
  const duration = formatDuration(transcript.duration_seconds);
  const savedNoun = transcript.source === "quo" ? "recording and transcript" : transcript.source === "memo" ? "recording" : "transcript";
  const recapRecipients = participants.filter((p) => p.isContact && p.contactId && p.email);

  // A short, just-captured phone note (option 8d) reads better as "Just
  // now · 34 seconds" than the standard source/duration line - same data,
  // same rows below, just a lighter-weight header for something she's
  // reviewing seconds after recording it, likely still standing there.
  const isPhoneMemo =
    transcript.source === "granola" &&
    transcript.duration_seconds != null &&
    transcript.duration_seconds < 90 &&
    Date.now() - new Date(transcript.created_at).getTime() < 10 * 60 * 1000;

  async function addParticipantAsContact(index: number) {
    const p = participants[index];
    if (!p) return;
    setAddingContact(index);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAddingContact(null);
      return;
    }

    const nameParts = (p.name ?? p.email ?? "Unknown").trim().split(/\s+/);
    const { data: firstStage, error: stageError } = await supabase.from("pipeline_stages").select("id").order("sort_order", { ascending: true }).limit(1).maybeSingle();
    if (stageError) {
      setAddingContact(null);
      return;
    }
    const { data: created, error: createError } = await supabase
      .from("contacts")
      .insert({
        owner_id: user.id,
        first_name: nameParts[0] ?? "Unknown",
        last_name: nameParts.slice(1).join(" ") || "",
        email: p.email,
        contact_type: "other",
        lead_source: `${SOURCE_LABEL[transcript.source]} (auto-created from meeting)`,
        stage_id: firstStage?.id ?? null,
      })
      .select("id")
      .single();
    if (createError || !created) {
      setAddingContact(null);
      return;
    }

    const updated = participants.map((row, i) => (i === index ? { ...row, isContact: true, contactId: created.id } : row));
    const { error: updateError } = await supabase.from("meeting_transcripts").update({ participants: updated }).eq("id", transcript.id);
    if (updateError) {
      setAddingContact(null);
      return;
    }
    setParticipants(updated);
    setAddingContact(null);
    router.refresh();
  }

  async function sendRecap() {
    setRecapSending(true);
    await Promise.all(recapRecipients.map((p) => sendEmailToContact(p.contactId as string, p.email as string, "Following up from our meeting", recapBody)));
    setRecapSending(false);
    setRecapSent(true);
  }

  // Every branch below used to fire-and-forget its Supabase call - a
  // denied/failed write left the UI marking the row "Saved" (and the
  // proposed_changes row "accepted") with nothing actually changed on the
  // contact, and no way to tell short of checking the record by hand.
  // Now every write is checked; the first failure aborts immediately, and
  // neither the audit-trail activity nor the proposed_changes status flips
  // to accepted unless the real field write actually succeeded.
  async function writeProposal(p: ProposedChange): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = createClient();
    const currentStage = stages.find((s) => s.id === contactStageId);

    switch (p.field) {
      case "budget": {
        const v = p.proposed_value as { min: number | null; max: number | null };
        const { error } = await supabase.from("contacts").update({ budget_min: v.min, budget_max: v.max }).eq("id", contactId);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "timeline": {
        const v = p.proposed_value as { timeline: string };
        const { error } = await supabase.from("contacts").update({ timeline: v.timeline }).eq("id", contactId);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "areas_of_interest": {
        const v = p.proposed_value as { area: string };
        const { data: c, error: readError } = await supabase.from("contacts").select("areas_of_interest").eq("id", contactId).maybeSingle();
        if (readError) return { ok: false, error: readError.message };
        const existing: string[] = c?.areas_of_interest ?? [];
        if (!existing.includes(v.area)) {
          const { error } = await supabase.from("contacts").update({ areas_of_interest: [...existing, v.area] }).eq("id", contactId);
          if (error) return { ok: false, error: error.message };
        }
        break;
      }
      case "decision_maker": {
        const v = p.proposed_value as { text: string };
        const { error } = await supabase.from("contacts").update({ decision_maker: v.text }).eq("id", contactId);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "objection": {
        const v = p.proposed_value as { text: string };
        const { error } = await supabase.from("contacts").update({ objection: v.text }).eq("id", contactId);
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "note": {
        const v = p.proposed_value as { text: string };
        const { error } = await supabase.from("activities").insert({
          owner_id: ownerId,
          contact_id: contactId,
          type: "note",
          direction: "none",
          source: "ai",
          body: v.text,
        });
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "task": {
        const v = p.proposed_value as { title: string; dueAt: string | null };
        const { error } = await supabase.from("tasks").insert({ owner_id: ownerId, contact_id: contactId, title: v.title, due_at: v.dueAt });
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "showing": {
        const v = p.proposed_value as { address: string };
        const { error } = await supabase.from("activities").insert({
          owner_id: ownerId,
          contact_id: contactId,
          type: "showing",
          direction: "none",
          source: "ai",
          body: v.address,
        });
        if (error) return { ok: false, error: error.message };
        break;
      }
      case "stage": {
        const v = p.proposed_value as { stageId: string; stageName: string };
        const newStage = stages.find((s) => s.id === v.stageId);
        const { error, dealId, dealMode, pendingAtRisk } = await applyStageChange(supabase, ownerId, contactId, currentStage, newStage);
        if (error) return { ok: false, error: error.message };
        if (dealId && dealMode) setDealModal({ id: dealId, mode: dealMode });
        if (pendingAtRisk) setPendingCleanup(pendingAtRisk);
        break;
      }
      case "tag": {
        const v = p.proposed_value as { tagId: string; name: string };
        const { error } = await supabase.from("contact_tags").upsert({ contact_id: contactId, tag_id: v.tagId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
        if (error) return { ok: false, error: error.message };
        break;
      }
    }

    // Every accept logs one activity noting where it came from, regardless
    // of field - "Saved changes show up in his activity as 'updated from
    // the Aug 27 call.'"
    const { error: logError } = await supabase.from("activities").insert({
      owner_id: ownerId,
      contact_id: contactId,
      type: "status_change",
      direction: "none",
      source: "ai",
      body: `Updated from the ${new Date(transcript.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${SOURCE_LABEL[transcript.source].toLowerCase()}`,
    });
    if (logError) return { ok: false, error: logError.message };

    const { error: statusError } = await supabase.from("proposed_changes").update({ status: "accepted" }).eq("id", p.id);
    if (statusError) return { ok: false, error: statusError.message };

    return { ok: true };
  }

  async function rejectProposal(p: ProposedChange): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = createClient();
    const { error } = await supabase.from("proposed_changes").update({ status: "rejected" }).eq("id", p.id);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  function removeFromList(id: string) {
    setProposals((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleAccept(p: ProposedChange) {
    const result = await writeProposal(p);
    if (result.ok) {
      removeFromList(p.id);
      router.refresh();
    }
    return result;
  }

  async function handleReject(p: ProposedChange) {
    const result = await rejectProposal(p);
    if (result.ok) {
      removeFromList(p.id);
      router.refresh();
    }
    return result;
  }

  async function saveAll() {
    setSaving(true);
    setSaveAllError(null);
    let failures = 0;
    for (const p of proposals) {
      const result = await writeProposal(p);
      if (result.ok) removeFromList(p.id);
      else failures++;
    }
    setSaving(false);
    router.refresh();
    if (failures > 0) {
      setSaveAllError(`${failures} of ${proposals.length} couldn't be saved - see which below and try again.`);
    }
  }

  async function saveNothing() {
    setSaving(true);
    setSaveAllError(null);
    let failures = 0;
    for (const p of proposals) {
      const result = await rejectProposal(p);
      if (result.ok) removeFromList(p.id);
      else failures++;
    }
    setSaving(false);
    router.refresh();
    if (failures > 0) {
      setSaveAllError(`${failures} of ${proposals.length} couldn't be skipped - see which below and try again.`);
    }
  }

  if (proposals.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-[18px] py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[15px] font-semibold text-neutral-600">
          {initials(contactName.split(" ")[0] ?? "", contactName.split(" ").slice(1).join(" "))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[22px] font-semibold leading-8 text-neutral-900">{contactName}</p>
          <p className="text-[15px] text-neutral-500">
            {isPhoneMemo ? (
              <>Just now{duration ? ` · ${duration}` : ""}</>
            ) : (
              <>
                {SOURCE_LABEL[transcript.source]} {relativeTime(transcript.occurred_at)}
                {duration ? ` · ${duration}` : ""} · {savedNoun} saved
              </>
            )}
          </p>
        </div>
      </div>

      {participants.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 px-[18px] py-3">
          {participants.map((p, i) => (
            <span
              key={`${p.email ?? p.name ?? i}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium ${
                p.isContact ? "border-neutral-200 bg-neutral-50 text-neutral-700" : "border-dashed border-neutral-300 text-neutral-500"
              }`}
            >
              {p.isContact && p.contactId ? (
                <Link href={`/contacts/${p.contactId}`}>{p.name ?? p.email}</Link>
              ) : (
                <span>{p.name ?? p.email ?? "Unknown"} · not in your CRM</span>
              )}
              {!p.isContact && (p.name || p.email) && (
                <button
                  type="button"
                  onClick={() => addParticipantAsContact(i)}
                  disabled={addingContact === i}
                  className="font-semibold text-brand-600 disabled:opacity-50"
                >
                  {addingContact === i ? "Adding…" : "Add as a contact"}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="px-[18px] pt-4">
        <p className="text-lg font-semibold text-neutral-900">Here&apos;s what I heard. Keep what&apos;s right.</p>
        <p className="mt-1 text-[15px] text-neutral-600">
          Nothing is saved to {firstName}&apos;s record until you press Save. Each line quotes where it came from.
        </p>
      </div>

      <div>
        {proposals.map((p) => (
          <ApproveRow key={p.id} proposal={p} stages={stages} onAccept={handleAccept} onReject={handleReject} />
        ))}
      </div>

      {recapRecipients.length > 0 && (
        <div className="border-t border-neutral-100 px-[18px] py-3.5">
          <button type="button" onClick={() => setRecapOpen((v) => !v)} className="text-sm font-semibold text-neutral-700">
            {recapOpen ? "Hide recap" : "Send them a recap"}
          </button>
          {recapOpen && (
            <div className="mt-2.5 rounded-xl border border-neutral-200 bg-[#fcfbfa] p-3.5">
              <p className="mb-2 text-sm text-neutral-500">
                To {recapRecipients.map((p) => p.name ?? p.email).join(", ")}. Nobody is sent anything until you press Send.
              </p>
              {recapSent ? (
                <p className="text-sm font-medium text-neutral-500">Sent.</p>
              ) : (
                <>
                  <textarea
                    rows={3}
                    value={recapBody}
                    onChange={(e) => setRecapBody(e.target.value)}
                    className="w-full rounded-[10px] border border-neutral-200 bg-white px-3 py-2.5 text-[15px] text-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={sendRecap}
                    disabled={recapSending || !recapBody.trim()}
                    className="mt-2.5 rounded-[10px] bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {recapSending ? "Sending…" : "Send"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {saveAllError && (
        <div className="border-t border-neutral-100 bg-red-50 px-[18px] py-2.5 text-sm font-medium text-red-700">{saveAllError}</div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-neutral-100 px-[18px] py-4">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="rounded-[10px] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save all ${proposals.length}`}
        </button>
        {isPhoneMemo ? (
          <span className="text-sm text-neutral-400">or review each one below</span>
        ) : (
          <>
            <button
              type="button"
              onClick={saveNothing}
              disabled={saving}
              className="rounded-[10px] border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
            >
              Save nothing
            </button>
            <span className="text-sm text-neutral-400">
              Saved changes show up in {firstName}&apos;s activity as &ldquo;updated from the{" "}
              {new Date(transcript.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {SOURCE_LABEL[transcript.source].toLowerCase()}.&rdquo;
            </span>
          </>
        )}
      </div>

      {dealModal && (
        <DealCelebrationModal
          dealId={dealModal.id}
          contactName={contactName}
          defaultLeadStartedAt={contactCreatedAt}
          defaultSide={(representing === "buyer" || representing === "seller" ? representing : null) as DealSide | null}
          mode={dealModal.mode ?? "celebrate"}
          onClose={() => setDealModal(null)}
        />
      )}
      {pendingCleanup && <PendingDealCleanupModal deals={pendingCleanup} onClose={() => setPendingCleanup(null)} />}
    </div>
  );
}
