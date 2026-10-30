"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { X, Video, Copy, Check } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { scheduleMeeting } from "@/app/(app)/contacts/meeting-actions";
import { APP_TIMEZONE } from "@/lib/format-time";

const DURATION_OPTIONS = [15, 30, 45, 60];

// Common US zones, plus whatever the browser reports as "here" (added
// below if it isn't already one of these) - a datetime-local input has no
// timezone of its own, so without an explicit choice the previous code
// silently took whatever zone the device happened to be set to, which is
// wrong the moment she's scheduling from a phone set to a different zone
// than the meeting itself.
const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || APP_TIMEZONE;
  } catch {
    return APP_TIMEZONE;
  }
}

// Rounds to the next quarter-hour so the default start time isn't a random
// minute in the past-feeling near-present - a small touch, but "2:47 PM"
// preselected reads as buggy where "2:45 PM" doesn't.
function defaultStart(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleMeetingModal({
  contactId,
  contactName,
  email,
  onClose,
}: {
  contactId: string;
  contactName: string;
  email: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(`Call with ${contactName}`);
  const [startAt, setStartAt] = useState(defaultStart);
  const [duration, setDuration] = useState(30);
  const [timeZone, setTimeZone] = useState(detectTimeZone);
  const timeZoneOptions = TIMEZONE_OPTIONS.some((z) => z.value === timeZone)
    ? TIMEZONE_OPTIONS
    : [{ value: timeZone, label: timeZone.replace(/_/g, " ").split("/").pop()! }, ...TIMEZONE_OPTIONS];
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: true; meetLink: string | null } | { ok: false; error: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    if (!title.trim() || !startAt) return;
    setSending(true);
    const outcome = await scheduleMeeting(contactId, {
      title: title.trim(),
      startAt: fromZonedTime(startAt, timeZone).toISOString(),
      durationMinutes: duration,
      notes: notes.trim() || undefined,
    });
    setSending(false);
    setResult(outcome);
    if (outcome.ok) router.refresh();
  }

  async function copyLink() {
    if (result?.ok && result.meetLink) {
      await navigator.clipboard.writeText(result.meetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="font-serif text-xl font-semibold text-neutral-900">Schedule a meeting</p>
            <p className="mt-0.5 text-xs text-neutral-500">{email ? `Google Meet invite to ${email}` : contactName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {result?.ok ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                <Video size={16} className="mt-0.5 shrink-0" />
                <span>
                  Meeting scheduled and the invite is on its way to <span className="font-semibold">{email}</span>.
                </span>
              </div>
              {result.meetLink && (
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">{result.meetLink}</span>
                  <Button variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with Jamie" />
              </div>

              <div className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Date &amp; time</label>
                  <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div className="w-28 space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Duration</label>
                  <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                    {DURATION_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500">Time zone</label>
                <Select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                  {timeZoneOptions.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500">Notes (optional)</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's this about?" rows={3} />
              </div>

              {email ? (
                <p className="text-xs text-neutral-400">Creates a Google Calendar event with a Google Meet link and emails {email} the invite.</p>
              ) : (
                <p className="text-xs text-red-600">This contact doesn&apos;t have an email on file - add one before scheduling.</p>
              )}

              {result && !result.ok && <p className="text-sm text-red-600">{result.error}</p>}

              <Button onClick={send} disabled={sending || !title.trim() || !startAt || !email} className="w-full">
                <Video size={15} /> {sending ? "Scheduling…" : "Schedule & send invite"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
