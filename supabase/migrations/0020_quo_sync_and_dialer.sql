-- Quo contact sync bookkeeping - lets the backfill button pick up where it
-- left off (only contacts with quo_synced_at still null), and marks the
-- one-time sync trigger separate from future updates.
alter table public.contacts add column quo_synced_at timestamptz;

-- Dialer feature state. dialer_contacted_at is set the moment the owner
-- self-reports a call as "Connected" - this happens immediately, before
-- Quo's webhook (which carries the real duration/recording) has any chance
-- to arrive, so the dialer queue can't wait on that data to know a contact
-- is done. dialer_snoozed_at is set on "No answer/voicemail" - it doesn't
-- remove the contact from the queue, just pushes them below everyone who
-- hasn't been tried yet.
alter table public.contacts add column dialer_contacted_at timestamptz;
alter table public.contacts add column dialer_snoozed_at timestamptz;

create index contacts_dialer_idx on public.contacts(owner_id, dialer_contacted_at) where archived = false;
