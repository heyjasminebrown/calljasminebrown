-- Tracks which contacts the one-time "suggest tags from old texts and
-- calls" backfill (Settings > Data repair) has already looked at, so
-- repeated Run clicks page through the backlog in batches instead of
-- reclassifying the same contacts every time - same idea as the batch
-- ceilings backfillNeedsReply/backfillInsightSignal already use, just
-- persisted since this job is O(contacts) and needs more than one run
-- to get through a real backlog.
alter table public.contacts add column tag_suggestions_backfilled_at timestamptz;
