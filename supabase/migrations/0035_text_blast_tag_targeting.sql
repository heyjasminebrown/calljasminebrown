-- Lets a text blast target a tag's members directly, instead of only an
-- event's registrants - not every bulk text is about a meetup (e.g. "all
-- House Hackers", "everyone tagged First-Time Buyer"). Stored so a past
-- tag-targeted blast can be reopened without guessing which tag its
-- "Tag: <name>" label refers to if the tag itself gets renamed later.
alter table public.text_blasts add column tag_id uuid references public.tags(id) on delete set null;
