-- 013: Add nullable commentary, prayer, guided_prayer, and prayer_note
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
-- Run BEFORE 014-week12-paul-content.sql, 017-paul-journey-content.sql,
-- and 018-paul-journey-content-fixes.sql.
--
-- commentary: teacher notes under a question or assignment card.
-- prayer: collapsible per-question Prayer card. Not the guided prayer.
-- guided_prayer: full read-and-confirm prayer. Used on the Week 1 prayer
--   assignment and on Week 2 Learning to Pray (reading type). An empty
--   string (not null) marks a reserved coming-soon slot on other types,
--   such as Week 2 Understanding Prayer. Prayer-type rows with null
--   guided_prayer also show coming soon (Weeks 3-6).
-- prayer_note: optional note on a Prayer card (for example the Q2
--   "same prayer" line). Kept in the database so copy is not hardcoded.
--
-- All four columns are nullable so existing rows stay valid.
--
-- RLS: 001 created "Anyone can view assignments" FOR SELECT USING (true).
-- Table-level SELECT policies cover new columns automatically. The guard
-- below recreates a SELECT policy only if none exists, so learners and
-- leaders can read the new columns.

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS commentary text;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS prayer text;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS guided_prayer text;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS prayer_note text;

COMMENT ON COLUMN assignments.commentary IS
  'Optional teacher commentary shown under a question or assignment.';

COMMENT ON COLUMN assignments.prayer IS
  'Optional per-question prayer for the collapsible Prayer card.';

COMMENT ON COLUMN assignments.guided_prayer IS
  'Optional guided prayer text. Empty string reserves a coming-soon slot. Prayer-type rows with null also show coming soon.';

COMMENT ON COLUMN assignments.prayer_note IS
  'Optional note shown on a Prayer card, such as a same-prayer cross reference.';

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
