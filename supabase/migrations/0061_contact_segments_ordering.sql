-- Saved segments (My lists) gain rename + reorder on mobile - the table
-- previously had no position column at all, ordering strictly by
-- created_at. Backfilled per-owner so existing segments get a stable
-- initial order rather than all landing on 0.
alter table public.contact_segments add column sort_order integer not null default 0;

update public.contact_segments
set sort_order = sub.rn
from (
  select id, row_number() over (partition by owner_id order by created_at) as rn
  from public.contact_segments
) sub
where public.contact_segments.id = sub.id;
