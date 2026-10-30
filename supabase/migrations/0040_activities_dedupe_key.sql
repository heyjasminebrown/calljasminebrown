-- Real columns for upsertActivity's dedupe key (previously just a JSON
-- path inside metadata, checked with a plain select-then-insert/update -
-- see lib/crm/activities.ts for why that's not safe under concurrency).
-- dedupe_value is null on rows that were never deduped (most manual
-- activity, or older rows written before this migration) and on any row
-- whose idValue was null - the partial unique index below only applies to
-- rows that actually opted into dedup.
alter table public.activities add column dedupe_field text;
alter table public.activities add column dedupe_value text;

create unique index activities_dedupe_key_idx on public.activities(owner_id, source, dedupe_field, dedupe_value) where dedupe_value is not null;
