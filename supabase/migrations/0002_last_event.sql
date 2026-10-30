-- Adds "last event attended" tracking to contacts, populated by the
-- Eventbrite and Jotform integrations so it's visible at a glance instead
-- of buried in the activity timeline. Run this in the Supabase SQL editor
-- after 0001_init.sql.

alter table public.contacts
  add column last_event_name text,
  add column last_event_at timestamptz;
