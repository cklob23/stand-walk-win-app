-- Optional follow-up AFTER reviewing 010-inspect-switcher-unread.sql.
--
-- Only needed if Part 2 of the inspect still shows unread type='message'
-- notifications whose pairing already has no unread inbound messages.
-- The switcher "2" itself is learners.length, not these rows — this
-- only cleans the bell if leftovers remain.
--
-- Run Part 1 (SELECT) first. Then Part 2 inside a transaction.

-- =============================================================================
-- PART 1 — PREVIEW (no writes)
-- =============================================================================

SELECT
    n.id,
    n.pairing_id,
    n.type,
    n.title,
    n.message,
    n.created_at,
    n.user_id
FROM notifications n
WHERE n.read = false
  AND n.type = 'message'
  AND n.pairing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM messages m
    JOIN pairings p ON p.id = m.pairing_id
    WHERE m.pairing_id = n.pairing_id
      AND m.is_read = false
      AND m.sender_id <> p.leader_id
      AND n.user_id = p.leader_id
  )
ORDER BY n.created_at DESC;

-- =============================================================================
-- PART 2 — MARK READ (run only after reviewing Part 1)
-- =============================================================================

BEGIN;

UPDATE notifications n
SET read = true
WHERE n.read = false
  AND n.type = 'message'
  AND n.pairing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM messages m
    JOIN pairings p ON p.id = m.pairing_id
    WHERE m.pairing_id = n.pairing_id
      AND m.is_read = false
      AND m.sender_id <> p.leader_id
      AND n.user_id = p.leader_id
  );

-- Review, then COMMIT; or ROLLBACK;
