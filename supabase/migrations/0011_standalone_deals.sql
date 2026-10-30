-- Backfilling historical deals (e.g. from a spreadsheet) shouldn't require
-- recreating a full contact record for each one just to satisfy a foreign
-- key - contact_id becomes optional, and client_name carries a plain-text
-- name for deals that aren't linked to a contact so the commission table
-- still shows whose deal it was.
alter table public.deals
  alter column contact_id drop not null,
  add column client_name text;
