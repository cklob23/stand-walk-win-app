-- QA follow-up (Oct 2026): after 007, Daily Reflection "Edited" hid on
-- older rows because reflection_updated_at was backfilled to created_at.
-- Rows that were actually edited later still have a later updated_at.
--
-- Apply in the Supabase SQL editor AFTER reviewing Part 1.
-- Safe to re-run. Not hardcoded to any user.
--
-- Conservative: a row counts as an edited reflection only when
--   1) it has daily reflection content (prayer_items or daily god_speaking)
--   2) reflection_updated_at is still the 007 sentinel (≈ created_at)
--   3) updated_at is at least 60s after created_at
--   4) the last write is NOT explained by a custom_entry timestamp
--      (custom add/share still bump updated_at; those must not become "Edited")
--
-- Do NOT add a generic BEFORE UPDATE trigger.

-- =============================================================================
-- PART 1 — INSPECTION (run this first; no writes)
-- =============================================================================

-- 1a) Candidates we would update (KEEP / apply)
WITH exploded AS (
    SELECT
        p.id,
        p.user_id,
        p.journal_date,
        p.created_at,
        p.updated_at,
        p.reflection_updated_at,
        MAX(
            CASE
                WHEN elem.value->>'created_at' IS NULL THEN NULL
                ELSE (elem.value->>'created_at')::timestamptz
            END
        ) AS latest_custom_at
    FROM prayer_journal p
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(p.custom_entries, '[]'::jsonb)) = 'array'
            THEN COALESCE(p.custom_entries, '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) AS elem(value) ON TRUE
    WHERE p.reflection_updated_at IS NOT NULL
      AND p.updated_at IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at))) < 2
      AND EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) >= 60
      AND (
        COALESCE(TRIM(p.prayer_items), '') <> ''
        OR COALESCE(TRIM(split_part(p.god_speaking, E'\n\n---\n\n', 1)), '') <> ''
      )
    GROUP BY
        p.id, p.user_id, p.journal_date,
        p.created_at, p.updated_at, p.reflection_updated_at
)
SELECT
    id,
    user_id,
    journal_date,
    created_at,
    updated_at,
    reflection_updated_at,
    latest_custom_at,
    ROUND(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0, 1) AS minutes_after_create,
    'APPLY' AS action
FROM exploded
WHERE latest_custom_at IS NULL
   OR ABS(EXTRACT(EPOCH FROM (updated_at - latest_custom_at))) > 5
ORDER BY journal_date DESC, user_id, id;

-- 1b) Rows that look edited but the last write matches a custom entry
--     (excluded — do not treat as a Daily Reflection edit)
WITH exploded AS (
    SELECT
        p.id,
        p.user_id,
        p.journal_date,
        p.created_at,
        p.updated_at,
        p.reflection_updated_at,
        MAX(
            CASE
                WHEN elem.value->>'created_at' IS NULL THEN NULL
                ELSE (elem.value->>'created_at')::timestamptz
            END
        ) AS latest_custom_at
    FROM prayer_journal p
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(p.custom_entries, '[]'::jsonb)) = 'array'
            THEN COALESCE(p.custom_entries, '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) AS elem(value) ON TRUE
    WHERE p.reflection_updated_at IS NOT NULL
      AND p.updated_at IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at))) < 2
      AND EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) >= 60
      AND (
        COALESCE(TRIM(p.prayer_items), '') <> ''
        OR COALESCE(TRIM(split_part(p.god_speaking, E'\n\n---\n\n', 1)), '') <> ''
      )
    GROUP BY
        p.id, p.user_id, p.journal_date,
        p.created_at, p.updated_at, p.reflection_updated_at
)
SELECT
    id,
    user_id,
    journal_date,
    created_at,
    updated_at,
    latest_custom_at,
    'SKIP_CUSTOM_WRITE' AS action
FROM exploded
WHERE latest_custom_at IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (updated_at - latest_custom_at))) <= 5
ORDER BY journal_date DESC, user_id, id;

-- =============================================================================
-- PART 2 — UPDATE (run only after reviewing Part 1)
-- =============================================================================

BEGIN;

WITH exploded AS (
    SELECT
        p.id,
        p.updated_at,
        MAX(
            CASE
                WHEN elem.value->>'created_at' IS NULL THEN NULL
                ELSE (elem.value->>'created_at')::timestamptz
            END
        ) AS latest_custom_at
    FROM prayer_journal p
    LEFT JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(COALESCE(p.custom_entries, '[]'::jsonb)) = 'array'
            THEN COALESCE(p.custom_entries, '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) AS elem(value) ON TRUE
    WHERE p.reflection_updated_at IS NOT NULL
      AND p.updated_at IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (p.reflection_updated_at - p.created_at))) < 2
      AND EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) >= 60
      AND (
        COALESCE(TRIM(p.prayer_items), '') <> ''
        OR COALESCE(TRIM(split_part(p.god_speaking, E'\n\n---\n\n', 1)), '') <> ''
      )
    GROUP BY p.id, p.updated_at
),
to_apply AS (
    SELECT id, updated_at
    FROM exploded
    WHERE latest_custom_at IS NULL
       OR ABS(EXTRACT(EPOCH FROM (updated_at - latest_custom_at))) > 5
)
UPDATE prayer_journal p
SET reflection_updated_at = to_apply.updated_at
FROM to_apply
WHERE p.id = to_apply.id;

-- Review the change, then:
--   COMMIT;
-- or
--   ROLLBACK;
