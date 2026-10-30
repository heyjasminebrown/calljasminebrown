-- She wants pending meeting requests to be unmissable (surfaced on Today
-- as top priority, and a push nudge if she sits on one too long) and a
-- real "propose a different time" path when she can't make the
-- requested one - the visitor confirms the new time themselves through a
-- link, and that confirmation is what actually books it and sends the
-- calendar invite, not her decline action.
alter table public.booking_requests add column reminder_sent_at timestamptz;
alter table public.booking_requests add column proposed_starts_at timestamptz;
alter table public.booking_requests add column proposed_ends_at timestamptz;
alter table public.booking_requests add column propose_token text unique;

alter table public.booking_requests drop constraint if exists booking_requests_stage_check;
alter table public.booking_requests add constraint booking_requests_stage_check
  check (stage in ('info', 'time_selected', 'pending', 'time_proposed', 'approved', 'declined', 'canceled'));
