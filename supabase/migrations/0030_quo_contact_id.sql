-- Stores the actual Quo contact ID returned when we create a contact there,
-- so every future sync PATCHes that known ID directly instead of searching
-- Quo's API for a match first. That search (filtering by externalIds[]/
-- sources[]) was never confirmed to actually work against a real response -
-- it appears Quo doesn't honor those filters, so the search was silently
-- returning an unrelated contact and overwriting their name/number with
-- whoever synced next. See lib/quo/sync-contact.ts.
alter table public.contacts add column if not exists quo_contact_id text;
