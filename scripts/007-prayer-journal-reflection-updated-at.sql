-- QA follow-up (Oct 2026): Daily Reflection "Edited" time was the row's
-- updated_at, which also changes when a custom entry / share / attachment
-- is written. Track reflection-field edits separately.
--
-- Apply in the Supabase SQL editor (or `supabase db push`) AFTER deploy.
-- Safe to re-run.
--
-- Adds prayer_journal.reflection_updated_at. App code sets it ONLY when
-- prayer_items / the daily god_speaking free-text are saved. Do NOT add a
-- generic BEFORE UPDATE trigger for this column.

ALTER TABLE prayer_journal
  ADD COLUMN IF NOT EXISTS reflection_updated_at TIMESTAMPTZ;

-- Existing rows: treat created_at as the last reflection write so we do not
-- inherit a custom-entry bump as "Edited".
UPDATE prayer_journal
SET reflection_updated_at = created_at
WHERE reflection_updated_at IS NULL
  AND (
    COALESCE(TRIM(prayer_items), '') <> ''
    OR COALESCE(TRIM(split_part(god_speaking, E'\n\n---\n\n', 1)), '') <> ''
  );
