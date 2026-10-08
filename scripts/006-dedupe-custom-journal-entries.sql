-- QA follow-up (Oct 2026): titled "New Journal Entry" / custom-entry twins
--
-- FINDING: The learner journal list does NOT read a separate journal_entries
-- or reflections table. Titled cards (e.g. "QA TEST ENTRY") are objects in
-- prayer_journal.custom_entries (jsonb array on the one-row-per-day daily
-- reflection). Script 004 only deduped whole prayer_journal rows by
-- (user_id, journal_date), so identical custom_entries on the surviving
-- row were left behind.
--
-- Apply in the Supabase SQL editor AFTER reviewing Part 1.
-- Safe to re-run. Not hardcoded to any user.
--
-- Window: two custom items are twins only when they share user + parent
-- row + title + content AND created_at is within 15 seconds. Legitimate
-- same-title entries written minutes/hours apart are kept.
--
-- No UNIQUE constraint is added. Multiple custom entries per day are
-- allowed; a unique on title/content would block that.

-- =============================================================================
-- PART 1 — INSPECTION (run this first; no writes)
-- =============================================================================

-- 1a) Does a leftover journal_entries table even exist? (journal UI never reads it)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prayer_journal', 'journal_entries', 'reflections', 'journal_attachments', 'journal_reactions');

-- 1b) Leftover whole-row prayer_journal twins (004 should already have cleared these)
SELECT
    user_id,
    journal_date,
    COUNT(*) AS row_count,
    ARRAY_AGG(id ORDER BY created_at, id) AS ids
FROM prayer_journal
GROUP BY user_id, journal_date
HAVING COUNT(*) > 1
ORDER BY journal_date DESC, row_count DESC;

-- 1c) Duplicate titled custom_entries on the same daily row
--     (same user, same title + content, created within 15 seconds)
--     THIS is the inspection query for the "QA TEST ENTRY" cards.
WITH exploded AS (
    SELECT
        p.id AS journal_id,
        p.user_id,
        p.journal_date,
        p.pairing_id,
        elem.ordinality AS ord,
        elem.value AS entry,
        COALESCE(elem.value->>'title', '') AS title,
        COALESCE(elem.value->>'content', '') AS content,
        elem.value->>'created_at' AS created_at_raw,
        (elem.value->>'created_at')::timestamptz AS created_at
    FROM prayer_journal p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.custom_entries, '[]'::jsonb))
        WITH ORDINALITY AS elem(value, ordinality)
    WHERE jsonb_typeof(COALESCE(p.custom_entries, '[]'::jsonb)) = 'array'
      AND elem.value->>'created_at' IS NOT NULL
),
clustered AS (
    SELECT
        a.journal_id,
        a.user_id,
        a.journal_date,
        a.pairing_id,
        a.ord,
        a.title,
        a.content,
        a.created_at_raw,
        a.created_at,
        MIN(b.created_at) AS keep_created_at,
        COUNT(*) AS cluster_size
    FROM exploded a
    JOIN exploded b
      ON b.journal_id = a.journal_id
     AND b.user_id = a.user_id
     AND b.title = a.title
     AND b.content = a.content
     AND ABS(EXTRACT(EPOCH FROM (b.created_at - a.created_at))) <= 15
    GROUP BY
        a.journal_id, a.user_id, a.journal_date, a.pairing_id,
        a.ord, a.title, a.content, a.created_at_raw, a.created_at
)
SELECT
    journal_id,
    user_id,
    journal_date,
    title,
    LEFT(content, 80) AS content_preview,
    created_at,
    created_at_raw,
    keep_created_at,
    cluster_size,
    CASE WHEN created_at = keep_created_at THEN 'KEEP' ELSE 'DROP' END AS action
FROM clustered
WHERE cluster_size > 1
ORDER BY user_id, journal_date, title, created_at, ord;

-- 1d) Same-text titled verse/assignment blocks in god_speaking (inspect only;
--     006 does not rewrite god_speaking — those are a different write path)
SELECT
    p.id AS journal_id,
    p.user_id,
    p.journal_date,
    TRIM(section) AS section,
    COUNT(*) AS copies
FROM prayer_journal p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p.god_speaking, ''), E'\n\n---\n\n')) AS section
WHERE TRIM(section) LIKE '@@TITLE:%'
GROUP BY p.id, p.user_id, p.journal_date, TRIM(section)
HAVING COUNT(*) > 1
ORDER BY p.journal_date DESC;

-- =============================================================================
-- PART 2 — CLEANUP (run after reviewing Part 1)
-- Keeps the earliest custom_entries item in each 15s same-title+content cluster.
-- Re-points attachments / reactions / shared_sections keys onto the keeper.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _006_custom_dups ON COMMIT DROP AS
WITH exploded AS (
    SELECT
        p.id AS journal_id,
        p.user_id,
        elem.ordinality AS ord,
        elem.value AS entry,
        COALESCE(elem.value->>'title', '') AS title,
        COALESCE(elem.value->>'content', '') AS content,
        elem.value->>'created_at' AS created_at_raw,
        (elem.value->>'created_at')::timestamptz AS created_at
    FROM prayer_journal p
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.custom_entries, '[]'::jsonb))
        WITH ORDINALITY AS elem(value, ordinality)
    WHERE jsonb_typeof(COALESCE(p.custom_entries, '[]'::jsonb)) = 'array'
      AND elem.value->>'created_at' IS NOT NULL
),
clustered AS (
    SELECT
        a.journal_id,
        a.ord,
        a.entry,
        a.title,
        a.content,
        a.created_at_raw,
        a.created_at,
        MIN(b.created_at) AS keep_created_at,
        COUNT(*) AS cluster_size
    FROM exploded a
    JOIN exploded b
      ON b.journal_id = a.journal_id
     AND b.user_id = a.user_id
     AND b.title = a.title
     AND b.content = a.content
     AND ABS(EXTRACT(EPOCH FROM (b.created_at - a.created_at))) <= 15
    GROUP BY
        a.journal_id, a.ord, a.entry, a.title, a.content,
        a.created_at_raw, a.created_at
),
keep_raw AS (
    SELECT DISTINCT ON (journal_id, title, content, keep_created_at)
        journal_id,
        title,
        content,
        keep_created_at,
        created_at_raw AS keep_created_at_raw
    FROM clustered
    WHERE created_at = keep_created_at
    ORDER BY journal_id, title, content, keep_created_at, ord
)
SELECT
    c.journal_id,
    c.ord,
    c.entry,
    c.title,
    c.content,
    c.created_at_raw,
    c.created_at,
    c.keep_created_at,
    c.cluster_size,
    k.keep_created_at_raw,
    (c.cluster_size > 1 AND c.created_at <> c.keep_created_at) AS is_drop
FROM clustered c
JOIN keep_raw k
  ON k.journal_id = c.journal_id
 AND k.title = c.title
 AND k.content = c.content
 AND k.keep_created_at = c.keep_created_at;

-- Preview of what Part 2 will change (same rows as inspection 1c)
SELECT
    journal_id,
    title,
    created_at_raw,
    keep_created_at_raw,
    CASE WHEN is_drop THEN 'DROP' ELSE 'KEEP' END AS action
FROM _006_custom_dups
WHERE cluster_size > 1
ORDER BY journal_id, title, created_at, ord;

-- Reattach attachments: drop exact file twins on the keeper, then move the rest
DELETE FROM journal_attachments ja
USING _006_custom_dups d, journal_attachments keep_a
WHERE d.is_drop
  AND ja.journal_entry_id = d.journal_id
  AND ja.section_key = 'custom_' || d.created_at_raw
  AND keep_a.journal_entry_id = d.journal_id
  AND keep_a.section_key = 'custom_' || d.keep_created_at_raw
  AND keep_a.filename = ja.filename
  AND keep_a.file_size = ja.file_size;

UPDATE journal_attachments ja
SET section_key = 'custom_' || d.keep_created_at_raw
FROM _006_custom_dups d
WHERE d.is_drop
  AND ja.journal_entry_id = d.journal_id
  AND ja.section_key = 'custom_' || d.created_at_raw;

-- Reattach reactions the same way
DELETE FROM journal_reactions jr
USING _006_custom_dups d, journal_reactions keep_r
WHERE d.is_drop
  AND jr.journal_entry_id = d.journal_id
  AND jr.section_key = 'custom_' || d.created_at_raw
  AND keep_r.journal_entry_id = d.journal_id
  AND keep_r.section_key = 'custom_' || d.keep_created_at_raw
  AND keep_r.user_id = jr.user_id
  AND keep_r.emoji = jr.emoji;

UPDATE journal_reactions jr
SET section_key = 'custom_' || d.keep_created_at_raw
FROM _006_custom_dups d
WHERE d.is_drop
  AND jr.journal_entry_id = d.journal_id
  AND jr.section_key = 'custom_' || d.created_at_raw;

-- Merge share flags onto the keeper key, then drop the twin key
UPDATE prayer_journal p
SET shared_sections = (
    SELECT COALESCE(jsonb_object_agg(mapped.key, to_jsonb(mapped.val)), '{}'::jsonb)
    FROM (
        SELECT
            CASE
                WHEN e.key = 'custom_' || d.created_at_raw THEN 'custom_' || d.keep_created_at_raw
                ELSE e.key
            END AS key,
            BOOL_OR(e.value = 'true'::jsonb) AS val
        FROM jsonb_each(COALESCE(p.shared_sections, '{}'::jsonb)) e
        LEFT JOIN _006_custom_dups d
          ON d.journal_id = p.id
         AND d.is_drop
         AND e.key = 'custom_' || d.created_at_raw
        GROUP BY 1
    ) mapped
)
WHERE p.id IN (SELECT journal_id FROM _006_custom_dups WHERE is_drop);

-- Rewrite custom_entries without the dropped twins
UPDATE prayer_journal p
SET custom_entries = (
    SELECT COALESCE(jsonb_agg(d.entry ORDER BY d.ord), '[]'::jsonb)
    FROM _006_custom_dups d
    WHERE d.journal_id = p.id
      AND NOT d.is_drop
)
WHERE p.id IN (SELECT journal_id FROM _006_custom_dups WHERE is_drop);

SELECT
    COUNT(*) FILTER (WHERE is_drop) AS custom_items_dropped,
    COUNT(DISTINCT journal_id) FILTER (WHERE is_drop) AS prayer_journal_rows_rewritten
FROM _006_custom_dups;

COMMIT;
