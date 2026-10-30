"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { updateSchedulingSettings } from "@/app/(app)/scheduling/actions";
import type { SchedulingSettings, WeeklyHours, Weekday } from "@/types/database";

const DAY_LABELS: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const DAY_ORDER: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DURATION_OPTIONS = [15, 20, 30, 45, 60];
const DAYS_OUT_OPTIONS = [7, 14, 21, 30, 45, 60];
const VISIBLE_PCT_OPTIONS = [50, 60, 70, 80, 90, 100];
const BUFFER_OPTIONS = [0, 15, 20, 30, 45];

export function SchedulingSettingsCard({ settings, genericLink }: { settings: SchedulingSettings; genericLink: string }) {
  const router = useRouter();
  const [duration, setDuration] = useState(settings.duration_minutes);
  const [daysOut, setDaysOut] = useState(settings.days_out);
  const [visiblePct, setVisiblePct] = useState(settings.visible_slot_pct);
  const [bufferMinutes, setBufferMinutes] = useState(settings.buffer_minutes);
  const [hours, setHours] = useState<WeeklyHours>(settings.weekly_hours);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function updateDay(day: Weekday, patch: Partial<WeeklyHours[Weekday]>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await updateSchedulingSettings({ durationMinutes: duration, daysOut, visibleSlotPct: visiblePct, bufferMinutes, weeklyHours: hours });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  async function copyLink() {
    if (!genericLink) return;
    await navigator.clipboard.writeText(genericLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5 p-4">
      {genericLink && (
        <div>
          <p className="mb-1.5 text-sm font-semibold text-neutral-700">Your scheduling link</p>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-600">{genericLink}</span>
            <button
              type="button"
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-400">Share this anywhere — anyone who opens it picks their own time and types their own info.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-neutral-500">Meeting length</label>
          <select
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              setSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-500">Bookable out to</label>
          <select
            value={daysOut}
            onChange={(e) => {
              setDaysOut(Number(e.target.value));
              setSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
          >
            {DAYS_OUT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-500">How much of your real open time to show</label>
        <select
          value={visiblePct}
          onChange={(e) => {
            setVisiblePct(Number(e.target.value));
            setSaved(false);
          }}
          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
        >
          {VISIBLE_PCT_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p === 100 ? "Everything that's open" : `About ${p}%`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">
          Lower this to look busier on the page — the hidden slots are still really open, they just don&apos;t show.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-neutral-500">Buffer between meetings</label>
        <select
          value={bufferMinutes}
          onChange={(e) => {
            setBufferMinutes(Number(e.target.value));
            setSaved(false);
          }}
          className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
        >
          {BUFFER_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b === 0 ? "No buffer" : `${b} min`}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-400">Blocks this much time around your existing commitments so nothing books back to back.</p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-neutral-700">Weekly hours</p>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => (
            <div key={day} className="flex items-center gap-2">
              <label className="flex w-16 shrink-0 items-center gap-1.5 text-sm text-neutral-700">
                <input type="checkbox" checked={hours[day].enabled} onChange={(e) => updateDay(day, { enabled: e.target.checked })} />
                {DAY_LABELS[day]}
              </label>
              <input
                type="time"
                value={hours[day].start}
                onChange={(e) => updateDay(day, { start: e.target.value })}
                disabled={!hours[day].enabled}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-40"
              />
              <span className="text-neutral-400">–</span>
              <input
                type="time"
                value={hours[day].end}
                onChange={(e) => updateDay(day, { end: e.target.value })}
                disabled={!hours[day].enabled}
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 disabled:opacity-40"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-[10px] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save settings"}
      </button>
    </div>
  );
}
