-- Granola meetings now log a "meeting" activity (Granola's own summary as
-- the body) so a matched contact's timeline shows meeting notes alongside
-- calls/texts/emails, not just via the separate meeting_transcripts/
-- proposed_changes review pipeline - see lib/granola/process-note.ts.
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'house_hacking_site', 'site_form', 'checkin', 'instagram', 'blinq', 'scheduling', 'granola', 'ai', 'system'));
