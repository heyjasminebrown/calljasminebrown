"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageSquare, StickyNote, Users, Home, Mail, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logActivityWithOutcome } from "@/app/(app)/contacts/actions";
import { BottomSheet } from "@/components/mobile/BottomSheet";
import { Button, Select, Textarea, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dateInputToAppIso } from "@/lib/format-time";
import type { ActivityType } from "@/types/database";

type ContactOption = { id: string; first_name: string; last_name: string };
type Outcome = "connected" | "no_answer" | "left_voicemail";

const TYPE_TILES: { value: ActivityType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: "call", label: "Call", icon: Phone },
  { value: "text", label: "Text", icon: MessageSquare },
  { value: "note", label: "Note", icon: StickyNote },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "showing", label: "Showing", icon: Home },
  { value: "email", label: "Email", icon: Mail },
];

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No answer" },
  { value: "left_voicemail", label: "Left voicemail" },
];

const FOLLOW_UP_OPTIONS: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

export function LogSheet({
  open,
  onClose,
  ownerId,
  contactId: prefilledContactId,
  contactName: prefilledContactName,
  initialType = "call",
}: {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  contactId?: string;
  contactName?: string;
  initialType?: ActivityType;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactOption[] | null>(null);
  const [contactId, setContactId] = useState(prefilledContactId ?? "");
  const [type, setType] = useState<ActivityType>(initialType);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [body, setBody] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || prefilledContactId || contacts) return;
    const supabase = createClient();
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("archived", false)
      .order("first_name")
      .then(({ data }) => setContacts((data ?? []) as ContactOption[]));
  }, [open, prefilledContactId, contacts]);

  useEffect(() => {
    if (open) {
      setContactId(prefilledContactId ?? "");
      setType(initialType);
      setOutcome(null);
      setFollowUpDays(null);
      setFollowUpDate("");
    }
  }, [open, prefilledContactId, initialType]);

  const showsOutcome = type === "call" || type === "text";

  async function save() {
    if (!contactId) return;
    setSaving(true);
    const nextFollowUpAt = followUpDate
      ? dateInputToAppIso(followUpDate)
      : followUpDays
        ? new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    await logActivityWithOutcome({
      contactId,
      type,
      body: body.trim() || null,
      outcome: showsOutcome && outcome ? outcome : undefined,
      nextFollowUpAt,
    });

    setSaving(false);
    setBody("");
    setType("call");
    router.refresh();
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Log"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="!px-4">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !contactId} className="flex-1">
            {saving ? "Saving…" : "Save activity"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Who</p>
          {prefilledContactName ? (
            <p className="text-[17px] font-semibold text-neutral-900">{prefilledContactName}</p>
          ) : (
            <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Choose a contact</option>
              {contacts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">What happened</p>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_TILES.map((tile) => (
              <button
                key={tile.value}
                type="button"
                onClick={() => setType(tile.value)}
                className={cn(
                  "flex h-[78px] flex-col items-center justify-center gap-1.5 rounded-[14px] border text-[13px] font-medium",
                  type === tile.value ? "border-transparent bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600",
                )}
              >
                <tile.icon size={20} />
                {tile.label}
              </button>
            ))}
          </div>
        </div>

        {showsOutcome && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Outcome (optional)</p>
            <div className="flex flex-wrap gap-2">
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOutcome(outcome === opt.value ? null : opt.value)}
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium",
                    outcome === opt.value ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600",
                  )}
                >
                  {outcome === opt.value && <Check size={14} />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Textarea rows={3} placeholder="Notes (optional)" value={body} onChange={(e) => setBody(e.target.value)} />

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[.09em] text-neutral-400">Next follow-up (optional)</p>
          <div className="flex flex-wrap items-center gap-2">
            {FOLLOW_UP_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                type="button"
                onClick={() => {
                  setFollowUpDays(followUpDays === opt.days ? null : opt.days);
                  setFollowUpDate("");
                }}
                className={cn(
                  "h-11 rounded-full px-3.5 text-[14px] font-medium",
                  followUpDays === opt.days ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600",
                )}
              >
                {opt.label}
              </button>
            ))}
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => {
                setFollowUpDate(e.target.value);
                setFollowUpDays(null);
              }}
              className="!h-11 w-auto !py-0"
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
