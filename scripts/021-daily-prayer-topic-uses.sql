-- 021: Track which topic inspired Today's prayer
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
--
-- What to run:
-- 1. Open the Supabase SQL editor for the SWR project (staging, then production).
-- 2. Paste and run this entire file (scripts/021-daily-prayer-topic-uses.sql).
-- 3. Confirm public.daily_prayers has journal_entry_id, journal_date, and topic_key.
--
-- The app uses these columns to count reflection uses (at most twice) and to
-- rotate assignment vs uplifting topics. If they are missing, Today's prayer
-- still opens, still ignores reflections older than yesterday, and still
-- caches one prayer per learner per day.

ALTER TABLE public.daily_prayers
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS journal_date date,
  ADD COLUMN IF NOT EXISTS topic_key text;

CREATE INDEX IF NOT EXISTS daily_prayers_user_journal_date_idx
  ON public.daily_prayers (user_id, journal_date)
  WHERE journal_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS daily_prayers_user_topic_key_idx
  ON public.daily_prayers (user_id, topic_key)
  WHERE topic_key IS NOT NULL;

COMMENT ON COLUMN public.daily_prayers.journal_entry_id IS
  'prayer_journal.id when this prayer was inspired by that reflection.';

COMMENT ON COLUMN public.daily_prayers.journal_date IS
  'prayer_journal.journal_date when this prayer was inspired by that day''s reflection.';

COMMENT ON COLUMN public.daily_prayers.topic_key IS
  'Stable topic id for rotation, for example reflection:uuid or assignment:3:title.';
