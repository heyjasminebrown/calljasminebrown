-- Quiet hours for text blasts: nothing stops a 6:40am send today. The
-- cron (lib/crm/text-blasts.ts) now holds a blast's pending sends until
-- 9:00 AM Eastern unless this is set - checked at "Send to N" time, in
-- the composer's "Send now anyway" override.
alter table public.text_blasts add column send_immediately boolean not null default false;
