-- Her real preferences: 10am-6pm M-F, half-hour starts (unchanged - the
-- slot grid already only ever starts on :00/:30), 50% visible ("looks
-- busier"), and a buffer around existing commitments so back-to-back
-- meetings don't get booked wall to wall.
alter table public.scheduling_settings add column buffer_minutes integer not null default 15 check (buffer_minutes >= 0);

alter table public.scheduling_settings alter column weekly_hours set default '{
  "mon": {"enabled": true, "start": "10:00", "end": "18:00"},
  "tue": {"enabled": true, "start": "10:00", "end": "18:00"},
  "wed": {"enabled": true, "start": "10:00", "end": "18:00"},
  "thu": {"enabled": true, "start": "10:00", "end": "18:00"},
  "fri": {"enabled": true, "start": "10:00", "end": "18:00"},
  "sat": {"enabled": false, "start": "10:00", "end": "18:00"},
  "sun": {"enabled": false, "start": "10:00", "end": "18:00"}
}';
alter table public.scheduling_settings alter column visible_slot_pct set default 50;

-- Applies to whatever row already exists from testing, not just future
-- ones - single-tenant app, this IS her real configuration now.
update public.scheduling_settings
set
  weekly_hours = '{
    "mon": {"enabled": true, "start": "10:00", "end": "18:00"},
    "tue": {"enabled": true, "start": "10:00", "end": "18:00"},
    "wed": {"enabled": true, "start": "10:00", "end": "18:00"},
    "thu": {"enabled": true, "start": "10:00", "end": "18:00"},
    "fri": {"enabled": true, "start": "10:00", "end": "18:00"},
    "sat": {"enabled": false, "start": "10:00", "end": "18:00"},
    "sun": {"enabled": false, "start": "10:00", "end": "18:00"}
  }',
  visible_slot_pct = 50,
  buffer_minutes = 15;

-- Simplifies the prep step to the one combined question she asked for -
-- drop the separate "notes" field, "questions" stays as the sole
-- free-text response.
alter table public.booking_requests drop column notes;
