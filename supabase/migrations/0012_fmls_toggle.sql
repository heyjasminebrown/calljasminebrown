-- Not every deal is on FMLS - defaults true since that's the common case,
-- so every deal recorded so far keeps computing FMLS the way it already
-- was; uncheck it per-deal for the exceptions.
alter table public.deals
  add column on_fmls boolean not null default true;
