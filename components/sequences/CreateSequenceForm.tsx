"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSequence,
  sendTestEmailDraft,
  getRecentlyEmailedContactIds,
  checkAudienceOverlap,
  type AudiencePreview,
  type AudienceOverlapWarning,
} from "@/app/(app)/sequences/actions";
import { Button, Input, Textarea, Select, Card, Label } from "@/components/ui";
import { EmailBodyEditor } from "@/components/sequences/EmailBodyEditor";
import { EmailTemplateButtons, EmailPreviewTest } from "@/components/sequences/EmailComposerHelpers";
import { AudiencePicker, type AudienceCriteria } from "@/components/sequences/AudiencePicker";
import { formatLocal } from "@/lib/format-time";
import { Plus, AlertTriangle, Send } from "lucide-react";
import type { Tag, PipelineStage } from "@/types/database";

type CreateType = "broadcast" | "drip" | "batch";

const EMPTY_CRITERIA: AudienceCriteria = { targetTagIds: [], excludeTagIds: [], excludeStageIds: [], excludeTimelines: [] };

export function CreateSequenceForm({ tags, stages, ownerId }: { tags: Tag[]; stages: PipelineStage[]; ownerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CreateType>("broadcast");
  const [criteria, setCriteria] = useState<AudienceCriteria>(EMPTY_CRITERIA);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Batch-only fields - a batch email is just a broadcast sequence with
  // one step, created in a single combined step instead of the usual
  // "create the sequence, then separately add a step" flow.
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendTiming, setSendTiming] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [audience, setAudience] = useState<AudiencePreview | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Mirrors the text blast modal's automatic last-hour skip, but visible
  // and configurable - a few days of email overlap between a drip step and
  // a one-off batch is common enough to want control over, not silent.
  const [excludeRecent, setExcludeRecent] = useState(true);
  const [excludeDays, setExcludeDays] = useState(3);
  const [recentlyEmailedIds, setRecentlyEmailedIds] = useState<string[]>([]);
  const [overlapWarning, setOverlapWarning] = useState<AudienceOverlapWarning | null>(null);
  const [overlapDismissedIds, setOverlapDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    if (type !== "batch" || !excludeRecent || excludeDays <= 0) {
      setRecentlyEmailedIds([]);
      return;
    }
    getRecentlyEmailedContactIds(excludeDays).then(setRecentlyEmailedIds);
  }, [type, excludeRecent, excludeDays]);

  const excludeContactIds = [...new Set([...recentlyEmailedIds, ...overlapDismissedIds])];

  useEffect(() => {
    if (type !== "batch" || !audience || audience.eligibleContactIds.length === 0) {
      setOverlapWarning(null);
      return;
    }
    checkAudienceOverlap(audience.eligibleContactIds).then(setOverlapWarning);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audience.eligibleContactIds identity changes every fetch; count+ids joined is the real key
  }, [type, audience?.eligibleContactIds.join(",")]);

  function leaveOverlapOut() {
    if (!overlapWarning) return;
    setOverlapDismissedIds((prev) => [...new Set([...prev, ...overlapWarning.overlapContactIds])]);
    setOverlapWarning(null);
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus size={15} /> New email
      </Button>
    );
  }

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || criteria.targetTagIds.length === 0) return;
    if (type !== "batch") {
      doCreate();
      return;
    }
    if (!subject.trim() || !body.trim()) return;
    if (sendTiming === "later" && !sendAt) return;
    if (!audience || audience.count === 0) {
      setError("Nobody's eligible to receive this - check the audience above before sending.");
      return;
    }
    setError("");
    setConfirming(true);
  }

  async function doCreate() {
    setSaving(true);
    setError("");

    const result = await createSequence({
      name: name.trim(),
      description: description.trim() || null,
      type,
      criteria,
      batchStep:
        type === "batch"
          ? { subject: subject.trim(), body: body.trim(), sendAt: sendTiming === "now" ? new Date().toISOString() : new Date(sendAt).toISOString() }
          : undefined,
      excludeContactIds: type === "batch" ? excludeContactIds : undefined,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    router.push(`/sequences/${result.id}`);
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-700">New email</h2>
      <form onSubmit={handleSubmitClick} className="space-y-3">
        <div>
          <Label htmlFor="seq-name">Name</Label>
          <Input id="seq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="August meetup reminders" />
        </div>
        <div>
          <Label htmlFor="seq-desc">Notes (optional, only you see this)</Label>
          <Textarea
            id="seq-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this is for, strategy notes, etc."
          />
        </div>
        <div>
          <Label htmlFor="seq-type">Type</Label>
          <Select id="seq-type" value={type} onChange={(e) => setType(e.target.value as CreateType)}>
            <option value="broadcast">Sequence (Scheduled Date)</option>
            <option value="drip">Drip</option>
            <option value="batch">Batch Email (one-off)</option>
          </Select>
        </div>
        <p className="text-xs text-neutral-400">
          {type === "broadcast" && "Each step fires on a fixed date/time, to whoever's in the audience below at send time."}
          {type === "drip" && "Each contact starts their own clock the moment they enter the audience below; steps fire at a delay relative to that."}
          {type === "batch" && "One email, sent once, to whoever's in the audience below - no ongoing steps."}
        </p>

        <AudiencePicker
          criteria={criteria}
          onChange={setCriteria}
          tags={tags}
          stages={stages}
          ownerId={ownerId}
          onTagCreated={() => router.refresh()}
          onAudienceChange={setAudience}
          excludeContactIds={type === "batch" ? excludeContactIds : []}
        />

        {type === "batch" && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <EmailTemplateButtons onPick={setBody} />
            <div>
              <Label htmlFor="batch-subject">Subject</Label>
              <Input id="batch-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            </div>
            <div>
              <Label htmlFor="batch-body">Body</Label>
              <EmailBodyEditor value={body} onChange={setBody} rows={5} placeholder="Email body — use {{first_name}} to personalize" />
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-neutral-100 bg-[#fafaf9] p-3 text-sm text-neutral-700">
              <input type="checkbox" checked={excludeRecent} onChange={(e) => setExcludeRecent(e.target.checked)} className="mt-0.5 accent-brand-600" />
              <span>
                Skip anyone I emailed in the last{" "}
                <input
                  type="number"
                  min={1}
                  value={excludeDays}
                  onChange={(e) => setExcludeDays(Number(e.target.value) || 1)}
                  disabled={!excludeRecent}
                  className="w-12 rounded-lg border border-neutral-200 px-1.5 py-0.5 text-center text-sm disabled:opacity-50"
                />{" "}
                days
                <span className="mt-1 block text-xs text-neutral-400">
                  Texts already skip anyone contacted in the last hour; email had no equivalent, so the same person could get a drip step and a one-off on
                  the same morning.
                </span>
              </span>
            </label>

            <EmailPreviewTest subject={subject} body={body} onSendTest={() => sendTestEmailDraft(subject, body)} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="batch-timing">Send</Label>
                <Select id="batch-timing" value={sendTiming} onChange={(e) => setSendTiming(e.target.value as "now" | "later")}>
                  <option value="now">Now (within ~15 min)</option>
                  <option value="later">Schedule for later</option>
                </Select>
              </div>
              {sendTiming === "later" && (
                <div>
                  <Label htmlFor="batch-send-at">Send at (Eastern time)</Label>
                  <Input id="batch-send-at" type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {confirming && type === "batch" && audience ? (
          <div className="space-y-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
            <p className="text-[15px] font-semibold text-neutral-900">
              Send to {audience.count} {audience.count === 1 ? "person" : "people"} {sendTiming === "now" ? "now" : `at ${new Date(sendAt).toLocaleString()}`}?
            </p>
            <p className="text-sm leading-5 text-neutral-600">
              {audience.names.slice(0, 4).join(", ")}
              {audience.count > 4 && ` and ${audience.count - Math.min(4, audience.names.length)} others`}. This can&apos;t be undone once it starts.
            </p>
            {overlapWarning && (
              <p className="flex items-start gap-2 text-sm leading-5 text-amber-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">
                    {overlapWarning.overlapContactIds.length} of these {audience.count}
                  </span>{" "}
                  also receive &ldquo;{overlapWarning.sequenceName}&rdquo; {formatLocal(overlapWarning.sendAt, "EEE, MMM d 'at' h:mm a")}.{" "}
                  <button type="button" onClick={leaveOverlapOut} className="font-semibold underline">
                    Leave them out of this one
                  </button>
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={saving} onClick={doCreate}>
                <Send size={14} /> {saving ? "Sending…" : `Send to ${audience.count}`}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                Back to editing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={
                saving ||
                !name.trim() ||
                criteria.targetTagIds.length === 0 ||
                (type === "batch" && (!subject.trim() || !body.trim() || (sendTiming === "later" && !sendAt) || !audience || audience.count === 0))
              }
            >
              {saving ? "Creating…" : type === "batch" ? "Create & send" : "Create & add steps"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
