-- 011: Leader notification when a learner completes the 6-week journey
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
--
-- What this does:
-- 1. Lets notifications.type store 'journey_complete' (and other types the app
--    already writes that were added after 001-create-tables.sql).
-- 2. Adds a unique index so a leader gets at most one journey-complete
--    notification per pairing. Two learners of the same leader stay distinct
--    because they have different pairing_id values.
--
-- App code also check-before-inserts. This index closes the race if two
-- requests detect completion at the same time.

-- Idempotency key used by lib/notifications.ts notifyLeaderOfJourneyComplete.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_journey_complete_pairing_uidx
  ON notifications (user_id, pairing_id)
  WHERE type = 'journey_complete' AND pairing_id IS NOT NULL;

-- Drop any CHECK on notifications.type so journey_complete can be stored.
-- Prod may still have the original 001 list, or a later expanded list.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Recreate an inclusive CHECK. If this statement fails because an unknown
-- type already exists in the table, the unique index above is still in place
-- and inserts of journey_complete still work without a CHECK.
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'message',
    'assignment',
    'assignment_reply',
    'assignment_reaction',
    'week_complete',
    'encouragement',
    'covenant',
    'pairing',
    'journal_shared',
    'meeting_request',
    'meeting_accepted',
    'meeting_declined',
    'meeting_counter_proposed',
    'meeting_completed',
    'member_request',
    'journey_complete'
  ));
