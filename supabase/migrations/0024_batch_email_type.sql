-- Adds 'batch' as a third email_sequences type: a one-off email to a
-- section of people (a tag), distinct from an ongoing "Sequence (Scheduled
-- Date)" or "Drip" campaign. Reuses the exact same send/tracking machinery
-- as broadcast (a batch is just a broadcast sequence with exactly one
-- step) - only the type label and creation UX differ.
alter table public.email_sequences drop constraint if exists email_sequences_type_check;
alter table public.email_sequences add constraint email_sequences_type_check
  check (type in ('broadcast', 'drip', 'batch'));
