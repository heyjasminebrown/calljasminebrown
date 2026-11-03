-- Booking calendars (Calendly-style "event types"): each has its own
-- name, link, length, available days/hours, buffer, how far ahead and how
-- soon people can book. The public booking page books instantly against
-- the chosen calendar.
create table if not exists public.booking_calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  duration_minutes integer not null default 20 check (duration_minutes between 5 and 480),
  -- Start times every N minutes; null = same as the meeting length.
  slot_interval_minutes integer check (slot_interval_minutes between 5 and 240),
  weekly_hours jsonb not null,
  days_out integer not null default 14 check (days_out between 1 and 180),
  buffer_minutes integer not null default 15 check (buffer_minutes between 0 and 240),
  min_notice_hours integer not null default 2 check (min_notice_hours between 0 and 336),
  active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

-- One default per owner (what /book and heyjasminebrown.com/meet open).
create unique index if not exists booking_calendars_one_default
  on public.booking_calendars (owner_id) where is_default;

alter table public.booking_calendars enable row level security;
drop policy if exists "owner full access" on public.booking_calendars;
create policy "owner full access" on public.booking_calendars
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.booking_requests add column if not exists calendar_id uuid references public.booking_calendars(id) on delete set null;
alter table public.booking_requests add column if not exists calendar_name text;

-- Starting calendar: "Intro call", 20 minutes, using her current weekly
-- hours if she has scheduling settings, otherwise Mon-Fri 10-6 ET.
insert into public.booking_calendars (owner_id, name, slug, description, duration_minutes, weekly_hours, days_out, buffer_minutes, is_default)
select
  u.id,
  'Intro call',
  'intro-call',
  null,
  20,
  coalesce(s.weekly_hours, '{
    "mon": {"enabled": true, "start": "10:00", "end": "18:00"},
    "tue": {"enabled": true, "start": "10:00", "end": "18:00"},
    "wed": {"enabled": true, "start": "10:00", "end": "18:00"},
    "thu": {"enabled": true, "start": "10:00", "end": "18:00"},
    "fri": {"enabled": true, "start": "10:00", "end": "18:00"},
    "sat": {"enabled": false, "start": "10:00", "end": "18:00"},
    "sun": {"enabled": false, "start": "10:00", "end": "18:00"}
  }'::jsonb),
  coalesce(s.days_out, 14),
  coalesce(s.buffer_minutes, 15),
  true
from auth.users u
left join public.scheduling_settings s on s.owner_id = u.id
where not exists (select 1 from public.booking_calendars b where b.owner_id = u.id);
