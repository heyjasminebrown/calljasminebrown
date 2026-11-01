"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { APP_TIMEZONE } from "@/lib/format-time";
import { cn, RELATIONSHIP_TYPE_LABELS } from "@/lib/utils";
import { TRIGGER_LABELS } from "@/lib/crm/text-campaign-rules";
import { deleteTextCampaign, setTextCampaignActive } from "@/app/(app)/sequences/text-campaign-actions";
import { TextCampaignEditor, type EditableCampaign } from "@/components/sequences/TextCampaignEditor";
import type { PipelineStage, RelationshipType, Tag } from "@/types/database";

export type CampaignRow = EditableCampaign & { id: string; active: boolean };

export type EnrollmentRow = {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  status: "active" | "completed" | "stopped";
  stop_reason: string | null;
  next_step: string | null;
  next_send_at: string | null;
  last_error: string | null;
  contacts: { first_name: string; last_name: string } | null;
};

export function TextCampaignsPanel({
  campaigns,
  enrollments,
  sendingEnabled,
  tags,
  stages,
  sources,
}: {
  campaigns: CampaignRow[];
  enrollments: EnrollmentRow[];
  sendingEnabled: boolean;
  tags: Tag[];
  stages: PipelineStage[];
  sources: string[];
}) {
  const [editing, setEditing] = useState<EditableCampaign | "new" | null>(null);

  return (
    <div className="space-y-3">
      {!sendingEnabled && (
        <p className="text-sm text-amber-700">
          Texting is switched off for the whole CRM (TEXT_AUTOMATION_ENABLED isn&apos;t &quot;true&quot; in Vercel), so no campaign sends.
        </p>
      )}
      {campaigns.length === 0 && <p className="text-sm text-neutral-500">No text campaigns yet.</p>}
      {campaigns.map((c) => (
        <CampaignCard
          key={c.id}
          campaign={c}
          rows={enrollments.filter((e) => e.campaign_id === c.id)}
          tags={tags}
          stages={stages}
          onEdit={() => setEditing(c)}
        />
      ))}
      <Button variant="secondary" onClick={() => setEditing("new")}>
        <Plus size={14} /> New text campaign
      </Button>
      {editing && (
        <TextCampaignEditor
          campaign={editing === "new" ? undefined : editing}
          tags={tags}
          stages={stages}
          sources={sources}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function triggerSummary(c: CampaignRow, tags: Tag[], stages: PipelineStage[]): string {
  const value =
    c.trigger_type === "tag"
      ? tags.find((t) => t.id === c.trigger_value)?.name ?? "a deleted tag"
      : c.trigger_type === "stage"
        ? stages.find((s) => s.id === c.trigger_value)?.name ?? "a deleted stage"
        : c.trigger_type === "type"
          ? RELATIONSHIP_TYPE_LABELS[c.trigger_value as RelationshipType] ?? c.trigger_value
          : c.trigger_value;
  return `${TRIGGER_LABELS[c.trigger_type]}: ${value}`;
}

function CampaignCard({
  campaign,
  rows,
  tags,
  stages,
  onEdit,
}: {
  campaign: CampaignRow;
  rows: EnrollmentRow[];
  tags: Tag[];
  stages: PipelineStage[];
  onEdit: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const active = rows.filter((r) => r.status === "active");
  const done = rows.filter((r) => r.status !== "active").slice(0, 10);
  const labelOf = (id: string | null) => campaign.steps.findIndex((s) => s.id === id) + 1;
  const name = (r: EnrollmentRow) => [r.contacts?.first_name, r.contacts?.last_name].filter(Boolean).join(" ") || "Contact";

  async function toggle() {
    setBusy(true);
    setError("");
    const result = await setTextCampaignActive(campaign.id, !campaign.active);
    setBusy(false);
    if (!result.ok) setError(`Couldn't switch it ${campaign.active ? "off" : "on"}: ${result.error}`);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const result = await deleteTextCampaign(campaign.id);
    setBusy(false);
    if (!result.ok) setError(`Couldn't delete: ${result.error}`);
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ddd7da] bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronDown size={16} className={cn("shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-neutral-900">{campaign.name}</span>
            <span className="block truncate text-[13px] text-neutral-500">
              {triggerSummary(campaign, tags, stages)} · {campaign.steps.length} text{campaign.steps.length === 1 ? "" : "s"} · {active.length} in progress
            </span>
          </span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={campaign.active}
          disabled={busy}
          onClick={() => void toggle()}
          className={cn(
            "rounded-full px-3 py-1 text-[13px] font-semibold disabled:opacity-50",
            campaign.active ? "bg-[#34223a] text-peach" : "border border-[#ddd7da] text-neutral-600",
          )}
        >
          {campaign.active ? "On" : "Off"}
        </button>
        <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label={`Edit ${campaign.name}`}>
          <Pencil size={15} />
        </button>
        <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${campaign.name}`}>
          <Trash2 size={15} />
        </button>
      </div>

      {confirmDelete && (
        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3 text-sm">
          <span className="text-neutral-600">Delete this campaign? Anyone in progress gets no more texts. Texts already sent stay on their timelines.</span>
          <Button variant="danger" size="sm" onClick={() => void remove()} disabled={busy}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
        </div>
      )}
      {error && <p className="border-t border-neutral-100 px-4 py-2 text-sm text-red-600">{error}</p>}

      {open && (
        <div className="space-y-4 border-t border-neutral-100 px-4 py-4 text-[14px]">
          <ol className="space-y-2 text-neutral-600">
            {campaign.steps.map((s, i) => (
              <li key={s.id}>
                <span className="font-semibold text-neutral-800">Text {i + 1}{i === 0 ? " (right away)" : ""}:</span> {s.body}
                <span className="block text-xs text-neutral-400">
                  Reply → {s.onReply.next ? `Text ${labelOf(s.onReply.next)} (~1 min later)` : "end"} · No reply →{" "}
                  {s.onNoReply.next ? `Text ${labelOf(s.onNoReply.next)}, ${s.onNoReply.days} day(s) later at ${s.onNoReply.time} ET` : "end"}
                </span>
              </li>
            ))}
          </ol>

          <div>
            <p className="font-semibold text-neutral-800">In progress ({active.length})</p>
            {active.length === 0 ? (
              <p className="text-neutral-500">No one right now.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {active.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-x-2">
                    <Link href={`/contacts/${r.contact_id}`} className="font-medium text-brand-700 hover:underline">
                      {name(r)}
                    </Link>
                    <span className="text-neutral-500">
                      {r.next_step ? `Text ${labelOf(r.next_step)} ${r.next_send_at ? formatInTimeZone(r.next_send_at, APP_TIMEZONE, "EEE MMM d, h:mm a") : ""}` : "waiting"}
                      {!campaign.active && " (paused - campaign is off)"}
                    </span>
                    {r.last_error && <span className="text-red-600">Last error: {r.last_error}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {done.length > 0 && (
            <div>
              <p className="font-semibold text-neutral-800">Recently finished or stopped</p>
              <ul className="mt-1 space-y-1">
                {done.map((r) => (
                  <li key={r.id} className="flex flex-wrap gap-x-2">
                    <Link href={`/contacts/${r.contact_id}`} className="font-medium text-brand-700 hover:underline">
                      {name(r)}
                    </Link>
                    <span className="text-neutral-500">{r.stop_reason ?? r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
