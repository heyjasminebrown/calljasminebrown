alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'house_hacking_site', 'site_form', 'ai', 'system'));
