-- QA follow-up (Oct 8, 2026): scripts/008 copied prayer_journal.updated_at
-- onto reflection_updated_at so Daily Reflection would show "Edited".
--
-- That value was already wrong. Script 005 installs a BEFORE UPDATE trigger
-- that sets updated_at = NOW() on every write. Script 007's backfill
-- UPDATE therefore stamped updated_at with the migration run time (QA saw
-- Edited Oct 8, 2026, 8:39 AM ET = 12:39 UTC — a timezone display of that
-- stamp, not the Oct 7 ~10:38 PM ET reflection edit). 008 then copied it.
--
-- The real 10:38 PM edit is not stored anywhere we can recover. Prefer
-- no "Edited" label over a misleading morning-after time.
--
-- Conservative reset: set reflection_updated_at = created_at (hides Edited)
-- only when the stored time looks like a 007/005 batch stamp, not a later
-- in-app reflection save:
--   1) daily reflection content exists
--   2) reflection_updated_at is after created_at (currently shows Edited)
--   3) AND either
--      a) the exact reflection_updated_at second is shared by 2+ rows
--         (007 trigger NOW() fingerprint), OR
--      b) created_at and reflection_updated_at fall on different
--         America/New_York calendar days and are >= 2 hours apart
--
-- Apply in the Supabase SQL editor. Run Part 1 first.
-- Safe to re-run. Not hardcoded to any user.
-- Do NOT add a trigger on reflection_updated_at.

-- =============================================================================
-- PART 1 — INSPECTION (run this first; no writes)
-- =============================================================================

WITH stamped AS (
    SELECT
        p.id,
        p.user_id,
        p.journal_date,
        p.created_at,
        p.updated_at,
        p.reflection_updated_at,
        date_trunc('second', p.reflection_updated_at) AS stamped_second,
        (p.created_at AT TIME ZONE 'America/New_York')::date AS created_et_date,
        (p.reflection_updated_at AT TIME ZONE 'America/New_York')::date AS reflected_et_date,
        EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at)) AS gap_seconds
    FROM prayer_journal p
    WHERE p.reflection_updated_at IS NOT NULL
      AND p.created_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at)) > 1
      AND (
        COALESCE(TRIM(p.prayer_items), '') <> ''
        OR COALESCE(TRIM(split_part(p.god_speaking, E'\n\n---\n\n', 1)), '') <> ''
      )
),
clustered AS (
    SELECT stamped_second, COUNT(*) AS cluster_size
    FROM stamped
    GROUP BY stamped_second
)
SELECT
    s.id,
    s.user_id,
    s.journal_date,
    s.created_at,
    s.reflection_updated_at,
    s.created_et_date,
    s.reflected_et_date,
    ROUND(s.gap_seconds / 3600.0, 2) AS hours_after_create,
    c.cluster_size,
    CASE
        WHEN c.cluster_size >= 2 THEN 'RESET_CLUSTER'
        WHEN s.created_et_date IS DISTINCT FROM s.reflected_et_date
             AND s.gap_seconds >= 7200 THEN 'RESET_NEXT_LOCAL_DAY'
        ELSE 'KEEP'
    END AS action
FROM stamped s
JOIN clustered c ON c.stamped_second = s.stamped_second
ORDER BY action, s.journal_date DESC, s.user_id, s.id;

-- =============================================================================
-- PART 2 — UPDATE (run only after reviewing Part 1)
-- =============================================================================

BEGIN;

WITH stamped AS (
    SELECT
        p.id,
        p.created_at,
        p.reflection_updated_at,
        date_trunc('second', p.reflection_updated_at) AS stamped_second,
        (p.created_at AT TIME ZONE 'America/New_York')::date AS created_et_date,
        (p.reflection_updated_at AT TIME ZONE 'America/New_York')::date AS reflected_et_date,
        EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at)) AS gap_seconds
    FROM prayer_journal p
    WHERE p.reflection_updated_at IS NOT NULL
      AND p.created_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at)) > 1
      AND (
        COALESCE(TRIM(p.prayer_items), '') <> ''
        OR COALESCE(TRIM(split_part(p.god_speaking, E'\n\n---\n\n', 1)), '') <> ''
      )
),
clustered AS (
    SELECT stamped_second, COUNT(*) AS cluster_size
    FROM stamped
    GROUP BY stamped_second
),
to_reset AS (
    SELECT s.id, s.created_at
    FROM stamped s
    JOIN clustered c ON c.stamped_second = s.stamped_second
    WHERE c.cluster_size >= 2
       OR (
         s.created_et_date IS DISTINCT FROM s.reflected_et_date
         AND s.gap_seconds >= 7200
       )
)
UPDATE prayer_journal p
SET reflection_updated_at = to_reset.created_at
FROM to_reset
WHERE p.id = to_reset.id;

-- Review the change, then:
--   COMMIT;
-- or
--   ROLLBACK;
