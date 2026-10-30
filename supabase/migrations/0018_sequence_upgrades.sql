-- Individual steps can be held without pausing the whole sequence - e.g.
-- to fix a typo in one email without stopping everything else mid-flight.
alter table public.email_sequence_steps add column active boolean not null default true;

-- Free-form notes for her own reference - never sent to contacts.
alter table public.email_sequences add column description text;

-- A single drip contact can be paused (e.g. "hold off on Jane for now")
-- without unsubscribing them (that's email_sequence_exclusions - a
-- deliberate opt-out) or touching the sequence as a whole.
alter table public.email_sequence_enrollments drop constraint if exists email_sequence_enrollments_status_check;
alter table public.email_sequence_enrollments add constraint email_sequence_enrollments_status_check
  check (status in ('active', 'paused', 'completed'));
