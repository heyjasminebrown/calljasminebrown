"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify, validateCalendar, type CalendarInput } from "@/lib/crm/booking-calendars";
import type { BookingCalendar } from "@/types/database";

type Result = { ok: true } | { ok: false; error: string };

async function owner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

function done(): Result {
  revalidatePath("/scheduling");
  return { ok: true };
}

export async function saveBookingCalendar(input: CalendarInput): Promise<Result> {
  const problem = validateCalendar(input);
  if (problem) return { ok: false, error: problem };
  const { supabase, userId } = await owner();
  if (!userId) return { ok: false, error: "Your session expired - sign in again." };

  const row = {
    name: input.name.trim(),
    slug: input.slug,
    description: input.description.trim() || null,
    duration_minutes: input.durationMinutes,
    slot_interval_minutes: input.slotIntervalMinutes,
    weekly_hours: input.weeklyHours,
    days_out: input.daysOut,
    buffer_minutes: input.bufferMinutes,
    min_notice_hours: input.minNoticeHours,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  const { error } = input.id
    ? await supabase.from("booking_calendars").update(row).eq("id", input.id)
    : await supabase.from("booking_calendars").insert({ ...row, owner_id: userId });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Another calendar already uses the link "${input.slug}". Pick a different one.` };
    return { ok: false, error: `Couldn't save: ${error.message}` };
  }
  return done();
}

export async function setBookingCalendarActive(id: string, active: boolean): Promise<Result> {
  const { supabase } = await owner();
  const { data: cal } = await supabase.from("booking_calendars").select("is_default").eq("id", id).maybeSingle();
  if (!active && cal?.is_default) return { ok: false, error: "This is your main calendar (what /meet opens). Make another one the main calendar first." };
  const { error } = await supabase.from("booking_calendars").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: `Couldn't update: ${error.message}` };
  return done();
}

export async function setDefaultBookingCalendar(id: string): Promise<Result> {
  const { supabase, userId } = await owner();
  if (!userId) return { ok: false, error: "Your session expired - sign in again." };
  const { error: clearError } = await supabase.from("booking_calendars").update({ is_default: false }).eq("owner_id", userId).eq("is_default", true);
  if (clearError) return { ok: false, error: `Couldn't update: ${clearError.message}` };
  const { error } = await supabase.from("booking_calendars").update({ is_default: true, active: true }).eq("id", id);
  if (error) return { ok: false, error: `Couldn't update: ${error.message}` };
  return done();
}

export async function duplicateBookingCalendar(id: string): Promise<Result> {
  const { supabase, userId } = await owner();
  if (!userId) return { ok: false, error: "Your session expired - sign in again." };
  const { data } = await supabase.from("booking_calendars").select("*").eq("id", id).maybeSingle();
  const original = data as BookingCalendar | null;
  if (!original) return { ok: false, error: "That calendar no longer exists." };

  const { data: existing } = await supabase.from("booking_calendars").select("slug").eq("owner_id", userId);
  const taken = new Set((existing ?? []).map((r) => r.slug as string));
  const base = slugify(`${original.slug}-copy`) || "copy";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const { error } = await supabase.from("booking_calendars").insert({
    owner_id: userId,
    name: `Copy of ${original.name}`,
    slug,
    description: original.description,
    duration_minutes: original.duration_minutes,
    slot_interval_minutes: original.slot_interval_minutes,
    weekly_hours: original.weekly_hours,
    days_out: original.days_out,
    buffer_minutes: original.buffer_minutes,
    min_notice_hours: original.min_notice_hours,
    active: false,
    is_default: false,
    sort_order: original.sort_order + 1,
  });
  if (error) return { ok: false, error: `Couldn't duplicate: ${error.message}` };
  return done();
}

export async function deleteBookingCalendar(id: string): Promise<Result> {
  const { supabase } = await owner();
  const { data: cal } = await supabase.from("booking_calendars").select("is_default").eq("id", id).maybeSingle();
  if (cal?.is_default) return { ok: false, error: "This is your main calendar (what /meet opens). Make another one the main calendar first." };
  // Past and upcoming bookings stay (their calendar_id just clears).
  const { error } = await supabase.from("booking_calendars").delete().eq("id", id);
  if (error) return { ok: false, error: `Couldn't delete: ${error.message}` };
  return done();
}
