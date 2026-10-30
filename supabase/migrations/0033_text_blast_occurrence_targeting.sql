-- Lets a text blast target a specific event occurrence + attendance status
-- (attended / no-show / walk-in / registered) instead of only "everyone
-- ever registered under this event name". Both columns are nullable -
-- existing blasts stay as they were (event_name-only, no attendance
-- filter).
alter table public.text_blasts add column event_id text;
alter table public.text_blasts add column attendance_status text
  check (attendance_status in ('registered', 'attended', 'no_show', 'walk_in'));
