-- Separate from created_at (when the row was inserted into the CRM) - a
-- bulk CSV import inserts everything "now", which made every backfilled
-- contact look like a brand-new lead in this week's/month's counts. This
-- holds the lead's real original date (booking/signup/registration), and
-- defaults to created_at for every existing row and every future insert
-- that doesn't explicitly set it (webhooks/real-time sources, where the
-- two are genuinely the same moment).
alter table public.contacts add column lead_date timestamptz not null default now();
update public.contacts set lead_date = created_at;
