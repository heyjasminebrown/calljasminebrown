import { createClient } from "@/lib/supabase/server";
import { ABANDONED_BOOKING_STAGES, ABANDONMENT_DELAY_MS } from "@/lib/crm/booking-abandonment";
import type { SchedulingSettings, BookingRequest, WeeklyHours } from "@/types/database";

const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: { enabled: true, start: "10:00", end: "18:00" },
  tue: { enabled: true, start: "10:00", end: "18:00" },
  wed: { enabled: true, start: "10:00", end: "18:00" },
  thu: { enabled: true, start: "10:00", end: "18:00" },
  fri: { enabled: true, start: "10:00", end: "18:00" },
  sat: { enabled: false, start: "10:00", end: "18:00" },
  sun: { enabled: false, start: "10:00", end: "18:00" },
};

// Lazily creates the settings row on first read rather than requiring a
// separate "set up scheduling" step - every owner gets sane defaults
// immediately, and Settings just edits them in place from here on.
export async function getSchedulingSettings(): Promise<SchedulingSettings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase.from("scheduling_settings").select("*").eq("owner_id", user.id).maybeSingle();
  if (existing) return existing as SchedulingSettings;

  const { data: created } = await supabase
    .from("scheduling_settings")
    .insert({ owner_id: user.id, weekly_hours: DEFAULT_WEEKLY_HOURS })
    .select("*")
    .maybeSingle();
  return (created as SchedulingSettings) ?? null;
}

export type BookingRequestWithContact = BookingRequest & { contact_name: string | null };

function withContactName(row: BookingRequest & { contacts: { first_name: string; last_name: string } | null }): BookingRequestWithContact {
  const { contacts, ...rest } = row;
  return { ...rest, contact_name: contacts ? `${contacts.first_name} ${contacts.last_name}`.trim() : null };
}

export async function listPendingBookingRequests(): Promise<BookingRequestWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, contacts(first_name, last_name)")
    .eq("stage", "pending")
    .order("starts_at", { ascending: true });

  return (data ?? []).map(withContactName);
}

// She proposed a different time (stage 'time_proposed') and is waiting on
// the visitor to confirm it through their own link - distinct from
// 'pending' (waiting on her) so it doesn't double-count in either queue.
export async function listProposedBookingRequests(): Promise<BookingRequestWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, contacts(first_name, last_name)")
    .eq("stage", "time_proposed")
    .order("created_at", { ascending: false });

  return (data ?? []).map(withContactName);
}

export async function listUpcomingApprovedBookingRequests(): Promise<BookingRequestWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, contacts(first_name, last_name)")
    .eq("stage", "approved")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);

  return (data ?? []).map(withContactName);
}

// Anyone who gave their name/phone (stage 'info') or even picked a time
// (stage 'time_selected') but never submitted the prep form - the
// "abandoned cart" she asked to be able to see and follow up on herself.
export async function listAbandonedBookingSessions(): Promise<BookingRequestWithContact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, contacts(first_name, last_name)")
    .in("stage", [...ABANDONED_BOOKING_STAGES])
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map(withContactName);
}

// Today / notify: only after 10 minutes sitting incomplete on the CRM
// Booking screen. Completing (pending+) drops the stage so the card
// clears even if the nudge already fired.
export async function listAbandonedBookingFollowUps(): Promise<BookingRequestWithContact[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - ABANDONMENT_DELAY_MS).toISOString();
  const { data } = await supabase
    .from("booking_requests")
    .select("*, contacts(first_name, last_name)")
    .in("stage", [...ABANDONED_BOOKING_STAGES])
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map(withContactName);
}
