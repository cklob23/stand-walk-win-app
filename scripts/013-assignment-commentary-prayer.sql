-- 013: Add nullable commentary and prayer columns on assignments
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
-- Run BEFORE 014-week12-paul-content.sql.
--
-- Both columns are nullable so existing rows stay valid. Prayer-type rows
-- store guided prayer text here. Other types use the same column for the
-- collapsible Prayer card under a question.
--
-- RLS: 001 created "Anyone can view assignments" FOR SELECT USING (true).
-- Postgres table-level SELECT policies cover new columns automatically.
-- The guard below recreates a SELECT policy only if none exists, so
-- learners and leaders can read commentary and prayer.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS commentary text;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS prayer text;

COMMENT ON COLUMN assignments.commentary IS
  'Optional teacher commentary shown under a question or assignment.';

COMMENT ON COLUMN assignments.prayer IS
  'Optional prayer text. On assignment_type prayer this is the guided prayer. On other types it is the collapsible Prayer card.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assignments'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Anyone can view assignments"
      ON assignments
      FOR SELECT
      USING (true);
  END IF;
END $$;
