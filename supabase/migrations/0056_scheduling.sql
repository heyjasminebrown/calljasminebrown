-- Self-serve booking, Calendly-style but simpler and always requiring her
-- approval before anything is final (her call - see the booking_requests
-- status flow below). Reuses the Google Calendar connection already set
-- up for Meet invites (lib/google/calendar.ts) - no new OAuth needed.

-- One row per owner - her weekly availability window, meeting length,
-- how far out it's bookable, and the "looks busier" display knob.
-- visible_slot_pct controls how much of her REAL open time actually
-- shows on the public page (100 = show everything; lower hides some
-- slots from the display only - her real capacity is unaffected, this
-- is purely about not looking wide open).
create table public.scheduling_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  duration_minutes integer not null default 30,
  days_out integer not null default 14,
  visible_slot_pct integer not null default 100 check (visible_slot_pct between 10 and 100),
  weekly_hours jsonb not null default '{
    "mon": {"enabled": true, "start": "09:00", "end": "17:00"},
    "tue": {"enabled": true, "start": "09:00", "end": "17:00"},
    "wed": {"enabled": true, "start": "09:00", "end": "17:00"},
    "thu": {"enabled": true, "start": "09:00", "end": "17:00"},
    "fri": {"enabled": true, "start": "09:00", "end": "17:00"},
    "sat": {"enabled": false, "start": "09:00", "end": "17:00"},
    "sun": {"enabled": false, "start": "09:00", "end": "17:00"}
  }',
  updated_at timestamptz not null default now()
);
alter table public.scheduling_settings enable row level security;
create policy "owner full access" on public.scheduling_settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A shareable /book/{slug} link - contact_id null is a generic link (she
-- shares it anywhere, the visitor types their own info); a link tied to a
-- contact prefills that contact's info so the resulting request attaches
-- to the right person automatically. Same "immutable slug, generate a
-- fresh one on real changes" spirit as quotes, but links themselves never
-- change shape, so they're just reused, not versioned.
create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create unique index booking_links_slug_idx on public.booking_links(slug);
create index booking_links_owner_contact_idx on public.booking_links(owner_id, contact_id);
alter table public.booking_links enable row level security;
create policy "owner full access" on public.booking_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A visitor's requested time - nothing is written to her real calendar or
-- confirmed to anyone until she approves it (her explicit requirement,
-- not a default she can silently skip). Declined/canceled rows are kept,
-- not deleted, for the same "never destroy history" reason activities
-- never get hard-deleted elsewhere in this app.
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  booking_link_id uuid not null references public.booking_links(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  visitor_name text not null,
  visitor_phone text not null,
  visitor_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'canceled')),
  google_event_id text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index booking_requests_owner_status_idx on public.booking_requests(owner_id, status, starts_at);
alter table public.booking_requests enable row level security;
create policy "owner full access" on public.booking_requests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'house_hacking_site', 'site_form', 'checkin', 'instagram', 'blinq', 'scheduling', 'ai', 'system'));
