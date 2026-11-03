"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, CopyPlus, ExternalLink, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import {
  deleteBookingCalendar,
  duplicateBookingCalendar,
  saveBookingCalendar,
  setBookingCalendarActive,
  setDefaultBookingCalendar,
} from "@/app/(app)/scheduling/calendar-actions";
import { DAY_LABELS, DAY_ORDER, DEFAULT_WEEKLY_HOURS, formatDuration, hoursSummary, slugify, type CalendarInput } from "@/lib/crm/booking-calendars";
import { cn } from "@/lib/utils";
import type { BookingCalendar, Weekday } from "@/types/database";

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const INTERVALS: { value: number | null; label: string }[] = [
  { value: null, label: "Same as the meeting length" },
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every hour" },
];
const BUFFERS = [0, 5, 10, 15, 30, 45, 60];
const DAYS_OUT = [7, 14, 21, 30, 45, 60, 90];
const NOTICE = [0, 1, 2, 4, 12, 24, 48, 72];

function linkFor(base: string, cal: BookingCalendar) {
  return cal.is_default ? base : `${base}/${cal.slug}`;
}

export function BookingCalendarsPanel({ calendars, publicBase, crmBase }: { calendars: BookingCalendar[]; publicBase: string; crmBase: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BookingCalendar | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(id);
    setError("");
    const result = await action();
    setBusy(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Couldn't copy - select the link and copy it yourself.");
    }
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-neutral-500">
        Each calendar is its own booking link with its own length and hours. Your main calendar opens at{" "}
        <span className="font-medium text-neutral-700">{publicBase.replace(/^https?:\/\//, "")}</span>. Times already busy on your Google Calendar never show.
      </p>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {calendars.map((cal) => {
        const link = linkFor(publicBase, cal);
        return (
          <div key={cal.id} className={cn("rounded-xl border border-[#ddd7da] p-4", !cal.active && "bg-neutral-50")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                  {cal.name}
                  {cal.is_default && <span className="rounded-full bg-[#f5e6dc] px-2 py-0.5 text-[11px] font-semibold text-[#34223a]">Main</span>}
                  {!cal.active && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">Off</span>}
                </p>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {formatDuration(cal.duration_minutes)} · {hoursSummary(cal.weekly_hours)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={cal.active}
                    disabled={busy === cal.id}
                    onChange={(e) => run(cal.id, () => setBookingCalendarActive(cal.id, e.target.checked))}
                  />
                  On
                </label>
                <button type="button" title="Edit" onClick={() => setEditing(cal)} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                  <Pencil size={15} />
                </button>
                <button type="button" title="Duplicate" disabled={busy === cal.id} onClick={() => run(cal.id, () => duplicateBookingCalendar(cal.id))} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                  <CopyPlus size={15} />
                </button>
                {!cal.is_default && (
                  <button type="button" title="Make this the main calendar" disabled={busy === cal.id} onClick={() => run(cal.id, () => setDefaultBookingCalendar(cal.id))} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                    <Star size={15} />
                  </button>
                )}
                {!cal.is_default && (
                  <button type="button" title="Delete" onClick={() => setConfirmDelete(cal.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {confirmDelete === cal.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                Delete &quot;{cal.name}&quot;? Its link stops working. Meetings already booked stay on your calendar.
                <button type="button" className="font-semibold underline" onClick={() => { setConfirmDelete(null); void run(cal.id, () => deleteBookingCalendar(cal.id)); }}>
                  Delete
                </button>
                <button type="button" className="font-medium" onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">{link.replace(/^https?:\/\//, "")}</span>
              <button type="button" onClick={() => copy(link, cal.id)} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[#34223a]">
                {copied === cal.id ? <Check size={14} /> : <Copy size={14} />} {copied === cal.id ? "Copied" : "Copy"}
              </button>
              <a
                href={`${crmBase}/book?calendar=${cal.slug}`}
                target="_blank"
                rel="noreferrer"
                title="Preview"
                className="flex shrink-0 items-center text-neutral-500 hover:text-[#34223a]"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="secondary" onClick={() => setEditing("new")}>
        <Plus size={15} className="mr-1 inline" /> New calendar
      </Button>

      {editing && <CalendarEditor calendar={editing === "new" ? null : editing} publicBase={publicBase} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CalendarEditor({ calendar, publicBase, onClose }: { calendar: BookingCalendar | null; publicBase: string; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<CalendarInput>(() => ({
    id: calendar?.id,
    name: calendar?.name ?? "",
    slug: calendar?.slug ?? "",
    description: calendar?.description ?? "",
    durationMinutes: calendar?.duration_minutes ?? 20,
    slotIntervalMinutes: calendar?.slot_interval_minutes ?? null,
    weeklyHours: calendar?.weekly_hours ?? DEFAULT_WEEKLY_HOURS,
    daysOut: calendar?.days_out ?? 14,
    bufferMinutes: calendar?.buffer_minutes ?? 15,
    minNoticeHours: calendar?.min_notice_hours ?? 2,
    active: calendar?.active ?? true,
  }));
  const [slugTouched, setSlugTouched] = useState(!!calendar);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const custom = !DURATIONS.includes(form.durationMinutes);

  const set = <K extends keyof CalendarInput>(key: K, value: CalendarInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setDay = (day: Weekday, patch: Partial<CalendarInput["weeklyHours"][Weekday]>) =>
    setForm((f) => ({ ...f, weeklyHours: { ...f.weeklyHours, [day]: { ...f.weeklyHours[day], ...patch } } }));

  async function save() {
    setSaving(true);
    setError("");
    const result = await saveBookingCalendar(form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-xl font-semibold text-neutral-900">{calendar ? "Edit calendar" : "New calendar"}</p>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              placeholder="Intro call"
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
          </div>
          <div>
            <Label>Link</Label>
            <div className="flex items-center gap-1 text-sm text-neutral-500">
              <span className="shrink-0">{publicBase.replace(/^https?:\/\//, "")}/</span>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
              />
            </div>
          </div>
          <div>
            <Label>Description (shown on the booking page)</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="A quick call to get to know each other." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Length</Label>
              <Select
                value={custom ? "custom" : String(form.durationMinutes)}
                onChange={(e) => set("durationMinutes", e.target.value === "custom" ? 25 : Number(e.target.value))}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </Select>
              {custom && (
                <Input
                  className="mt-2"
                  type="number"
                  min={5}
                  max={480}
                  value={form.durationMinutes}
                  onChange={(e) => set("durationMinutes", Number(e.target.value) || 0)}
                  aria-label="Length in minutes"
                />
              )}
            </div>
            <div>
              <Label>Start times</Label>
              <Select value={form.slotIntervalMinutes ?? ""} onChange={(e) => set("slotIntervalMinutes", e.target.value ? Number(e.target.value) : null)}>
                {INTERVALS.map((o) => (
                  <option key={o.label} value={o.value ?? ""}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Available days and hours (Eastern)</Label>
            <div className="space-y-1.5">
              {DAY_ORDER.map((day) => {
                const h = form.weeklyHours[day];
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2">
                    <label className="flex w-16 shrink-0 items-center gap-1.5 text-sm font-medium text-neutral-700">
                      <input type="checkbox" checked={h.enabled} onChange={(e) => setDay(day, { enabled: e.target.checked })} />
                      {DAY_LABELS[day]}
                    </label>
                    {h.enabled ? (
                      <>
                        <Input type="time" className="!w-32" value={h.start} onChange={(e) => setDay(day, { start: e.target.value })} aria-label={`${DAY_LABELS[day]} start`} />
                        <span className="text-sm text-neutral-400">to</span>
                        <Input type="time" className="!w-32" value={h.end} onChange={(e) => setDay(day, { end: e.target.value })} aria-label={`${DAY_LABELS[day]} end`} />
                      </>
                    ) : (
                      <span className="text-sm text-neutral-400">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Buffer around meetings</Label>
              <Select value={form.bufferMinutes} onChange={(e) => set("bufferMinutes", Number(e.target.value))}>
                {BUFFERS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? "None" : `${b} min`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Book up to</Label>
              <Select value={form.daysOut} onChange={(e) => set("daysOut", Number(e.target.value))}>
                {DAYS_OUT.map((d) => (
                  <option key={d} value={d}>
                    {d} days ahead
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Minimum notice</Label>
              <Select value={form.minNoticeHours} onChange={(e) => set("minNoticeHours", Number(e.target.value))}>
                {NOTICE.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : n < 24 ? `${n} hour${n === 1 ? "" : "s"}` : `${n / 24} day${n === 24 ? "" : "s"}`}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            Taking bookings
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
