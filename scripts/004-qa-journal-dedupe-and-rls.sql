-- QA follow-up (Oct 2026): journal save duplicates + Shared With Me visibility
--
-- Apply in the Supabase SQL editor (or `supabase db push`) AFTER deploy if
-- the unique index is not already present. Safe to re-run.
--
-- 1) Deduplicate prayer_journal rows that share (user_id, journal_date),
--    keeping the newest. The first-save / double-click bug inserted twins.
-- 2) Enforce one row per user per local day.
-- 3) Let a pairing partner SELECT shared journal entries (same source the
--    Shared With Me list and badge already use).

-- Move attachment / reaction FKs onto the surviving row before delete
UPDATE journal_attachments ja
SET journal_entry_id = keeper.id
FROM prayer_journal keeper
JOIN prayer_journal dup
  ON dup.user_id = keeper.user_id
 AND dup.journal_date = keeper.journal_date
 AND dup.id <> keeper.id
WHERE ja.journal_entry_id = dup.id
  AND keeper.id = (
    SELECT p.id
    FROM prayer_journal p
    WHERE p.user_id = dup.user_id
      AND p.journal_date = dup.journal_date
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id DESC
    LIMIT 1
  );

UPDATE journal_reactions jr
SET journal_entry_id = keeper.id
FROM prayer_journal keeper
JOIN prayer_journal dup
  ON dup.user_id = keeper.user_id
 AND dup.journal_date = keeper.journal_date
 AND dup.id <> keeper.id
WHERE jr.journal_entry_id = dup.id
  AND keeper.id = (
    SELECT p.id
    FROM prayer_journal p
    WHERE p.user_id = dup.user_id
      AND p.journal_date = dup.journal_date
    ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST, p.id DESC
    LIMIT 1
  );

DELETE FROM prayer_journal p
WHERE p.id <> (
  SELECT keeper.id
  FROM prayer_journal keeper
  WHERE keeper.user_id = p.user_id
    AND keeper.journal_date = p.journal_date
  ORDER BY keeper.updated_at DESC NULLS LAST, keeper.created_at DESC NULLS LAST, keeper.id DESC
  LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS prayer_journal_user_date_uidx
  ON prayer_journal (user_id, journal_date);

-- Partner visibility for shared entries (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prayer_journal'
      AND policyname = 'Partners can view shared journal entries'
  ) THEN
    CREATE POLICY "Partners can view shared journal entries"
      ON prayer_journal
      FOR SELECT
      USING (
        shared_with_leader = true
        AND pairing_id IN (
          SELECT id FROM pairings
          WHERE leader_id = auth.uid() OR learner_id = auth.uid()
        )
      );
  END IF;
END $$;
