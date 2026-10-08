-- QA follow-up (Oct 2026): prayer_journal.updated_at was not reliably
-- bumped on UPDATE, so the list kept showing the original created_at.
--
-- Apply in the Supabase SQL editor (or `supabase db push`) AFTER deploy.
-- Safe to re-run.
--
-- 1) Ensure the shared touch-updated_at helper exists.
-- 2) Attach a BEFORE UPDATE trigger on prayer_journal so every write
--    (app code, SQL editor, future paths) sets updated_at = NOW().

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_prayer_journal_updated_at ON prayer_journal;

CREATE TRIGGER update_prayer_journal_updated_at
  BEFORE UPDATE ON prayer_journal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
