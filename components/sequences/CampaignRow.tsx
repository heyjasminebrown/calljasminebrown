"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Pencil, Copy, Pause, Play, MailQuestion, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui";
import { SequenceOverviewStats } from "@/components/sequences/SequenceOverviewStats";
import { UpcomingBroadcastPanel } from "@/components/sequences/UpcomingBroadcastPanel";
import { RecentActivityFeed } from "@/components/sequences/RecentActivityFeed";
import { getCampaignReportData, duplicateSequence, createNonOpenerFollowup, type CampaignReportData } from "@/app/(app)/sequences/actions";
import { cancelTextBlast } from "@/app/(app)/contacts/text-blast-actions";
import { estimatedTextBlastMinutes } from "@/lib/crm/text-blast-timing";
import { formatLocal } from "@/lib/format-time";
import { cn, TAG_CHIP } from "@/lib/utils";
import type { SequenceListItem } from "@/lib/data/sequences";
import type { TextBlastWithProgress } from "@/app/(app)/contacts/text-blast-actions";
import type { Tag } from "@/types/database";

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

// Status/reports live behind this chevron now, on every campaign - the
// three components an old per-sequence page load used to require
// (SequenceOverviewStats, UpcomingBroadcastPanel, RecentActivityFeed) are
// fetched on demand instead.
export function EmailCampaignRow({ seq, tagById }: { seq: SequenceListItem; tagById: Map<string, Tag> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<CampaignReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followupResult, setFollowupResult] = useState<string | null>(null);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !report) {
      setLoading(true);
      setReport(await getCampaignReportData(seq.id));
      setLoading(false);
    }
  }

  const kindLabel = seq.type === "broadcast" ? "Scheduled" : seq.type === "batch" ? "Batch" : "Drip";
  const statusLabel = !seq.active
    ? "Paused"
    : seq.sendingNow
      ? "Sending"
      : seq.type === "drip"
        ? seq.activeEnrolled > 0
          ? "Active"
          : "No one enrolled"
        : seq.nextSendAt
          ? "Scheduled"
          : seq.sentTotal > 0
            ? "Sent"
            : "Draft";
  const statusTone =
    statusLabel === "Sending"
      ? "bg-amber-50 text-amber-700"
      : statusLabel === "Active" || statusLabel === "Scheduled"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-neutral-100 text-neutral-500";

  const meta =
    seq.type === "drip"
      ? `${seq.activeEnrolled} enrolled${seq.sentTotal > 0 ? ` · ${seq.sentTotal} sent · ${seq.openRate.toFixed(0)}% opened` : ""}`
      : [
          seq.nextSendAt ? `Next send ${formatLocal(seq.nextSendAt, "MMM d, h:mm a")}` : null,
          seq.sentTotal > 0 ? `${seq.sentTotal} sent · ${seq.openRate.toFixed(0)}% opened` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Nothing sent yet";

  async function togglePause() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("email_sequences").update({ active: !seq.active }).eq("id", seq.id);
    setBusy(false);
    router.refresh();
  }

  async function duplicate() {
    setBusy(true);
    const result = await duplicateSequence(seq.id);
    setBusy(false);
    if (result.ok) router.push(`/sequences/${result.id}`);
  }

  async function followUpNonOpeners() {
    setBusy(true);
    setFollowupResult(null);
    const result = await createNonOpenerFollowup(seq.id);
    setBusy(false);
    if (result.ok) router.push(`/sequences/${result.id}`);
    else setFollowupResult(result.error);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <button type="button" onClick={toggleOpen} className="flex w-full items-center gap-3 px-[18px] py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[17px] font-semibold text-neutral-900">{seq.name}</p>
            <Pill className="bg-neutral-100 text-neutral-600">Email · {kindLabel}</Pill>
            {seq.targetTags.map((t) => (
              <Badge key={t.id} className={TAG_CHIP}>
                {t.name}
              </Badge>
            ))}
            <Pill className={statusTone}>{statusLabel}</Pill>
          </div>
          <p className="mt-0.5 truncate text-sm text-neutral-500">{meta}</p>
        </div>
        {open ? <ChevronDown size={18} className="shrink-0 text-neutral-400" /> : <ChevronRight size={18} className="shrink-0 text-neutral-400" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-100 p-[18px]">
          {loading || !report ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : (
            <>
              <SequenceOverviewStats rollup={report.rollup} />
              {seq.type !== "drip" && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-neutral-700">Sends</p>
                  <UpcomingBroadcastPanel steps={report.upcomingSteps} />
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-700">Recent activity</p>
                <RecentActivityFeed items={report.activity} />
              </div>

              {report.nonOpenerCount > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#ebe9e7] bg-[#fcfbfa] px-4 py-3.5">
                  <MailQuestion size={18} className="shrink-0 text-neutral-400" />
                  <p className="min-w-0 flex-1 text-[15px] text-neutral-700">
                    <span className="font-semibold text-neutral-900">{report.nonOpenerCount} people</span> were sent this and didn&apos;t open it
                  </p>
                  <button
                    type="button"
                    onClick={followUpNonOpeners}
                    disabled={busy}
                    className="shrink-0 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                  >
                    Follow up the {report.nonOpenerCount}
                  </button>
                </div>
              )}
              {followupResult && <p className="text-xs text-red-600">{followupResult}</p>}

              {report.optedOutCount > 0 && (
                <p className="text-sm text-neutral-500">
                  {report.optedOutCount} {report.optedOutCount === 1 ? "person" : "people"} opted out of this audience ·{" "}
                  <Link href={`/sequences/${seq.id}#opt-outs`} className="font-medium text-brand-600">
                    see the opt-out list
                  </Link>
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3.5">
                <Link
                  href={`/sequences/${seq.id}`}
                  className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800"
                >
                  <Pencil size={14} className="text-neutral-500" /> Edit steps
                </Link>
                <button
                  type="button"
                  onClick={duplicate}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                >
                  <Copy size={14} className="text-neutral-500" /> Duplicate
                </button>
                <button
                  type="button"
                  onClick={togglePause}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
                >
                  {seq.active ? (
                    <>
                      <Pause size={14} className="text-neutral-500" /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={14} className="text-neutral-500" /> Resume
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Text blasts already carry everything the collapsed report needs (no
// second fetch) - the chevron just reveals the message and a cancel
// affordance for anything still sending.
export function TextCampaignRow({ blast, tagById }: { blast: TextBlastWithProgress; tagById: Map<string, Tag> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const tagName = blast.tag_id ? (tagById.get(blast.tag_id)?.name ?? null) : null;

  const statusLabel = blast.status === "sending" ? `Sending ${blast.sent} of ${blast.total}` : blast.status === "completed" ? "Sent" : "Canceled";
  const statusTone = blast.status === "sending" ? "bg-amber-50 text-amber-700" : blast.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500";
  const meta =
    blast.status === "sending" && blast.pending > 0
      ? `From your Quo number · about ${estimatedTextBlastMinutes(blast.pending)} min left`
      : `${blast.sent} of ${blast.total} sent${blast.failed > 0 ? ` · ${blast.failed} failed` : ""}`;

  async function cancel() {
    setCanceling(true);
    await cancelTextBlast(blast.id);
    setCanceling(false);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ebe9e7] bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-[18px] py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[17px] font-semibold text-neutral-900">{blast.event_name}</p>
            <Pill className="bg-neutral-100 text-neutral-600">Text · Blast</Pill>
            {tagName && <Badge color={blast.tag_id ? (tagById.get(blast.tag_id)?.color ?? undefined) : undefined}>{tagName}</Badge>}
            <Pill className={statusTone}>{statusLabel}</Pill>
          </div>
          <p className="mt-0.5 truncate text-sm text-neutral-500">{meta}</p>
        </div>
        {open ? <ChevronDown size={18} className="shrink-0 text-neutral-400" /> : <ChevronRight size={18} className="shrink-0 text-neutral-400" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-[18px]">
          <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">&ldquo;{blast.message}&rdquo;</p>
          {blast.status === "sending" && (
            <button
              type="button"
              onClick={cancel}
              disabled={canceling}
              className="flex items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-800 disabled:opacity-50"
            >
              <X size={14} className="text-neutral-500" /> {canceling ? "Canceling…" : "Cancel the rest"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
