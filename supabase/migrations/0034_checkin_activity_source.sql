-- New activity source for the QR check-in flow, replacing the Jotform
-- kiosk (kept as a valid value for old activities already on file).
alter table public.activities drop constraint if exists activities_source_check;
alter table public.activities add constraint activities_source_check
  check (source in ('manual', 'quo', 'gmail', 'calendly', 'eventbrite', 'jotform', 'house_hacking_site', 'site_form', 'checkin', 'ai', 'system'));
