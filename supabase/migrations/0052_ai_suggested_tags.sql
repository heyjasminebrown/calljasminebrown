-- Extends both AI-suggestion pipelines with tag suggestions, so a
-- text/call/meeting that implies a tag (e.g. "I just got my license,
-- thinking about joining your team" -> the "Agent" tag) can surface it
-- the same way a stage or timeline suggestion already does. The model
-- only ever picks from her existing tag list - it's never allowed to
-- invent a new tag name (her call, see 0051's "Agent" tag for why that
-- matters: uncontrolled AI-created tags would drift into duplicates).
alter table public.ai_insights add column suggested_tag_ids uuid[];

alter table public.proposed_changes drop constraint proposed_changes_field_check;
alter table public.proposed_changes add constraint proposed_changes_field_check check (field in (
  'budget', 'timeline', 'areas_of_interest', 'decision_maker', 'objection',
  'note', 'task', 'stage', 'showing', 'tag'
));
