-- QA (Oct 9, 2026): dashboard learner switcher showed "2" after one new
-- message, and the 2 survived opening the thread + hard reload.
--
-- The live switcher trigger badge is NOT unread. In
-- components/dashboard/learner-switcher.tsx it is `learners.length`
-- (active+pending pairings that have a learner). That number never
-- changes when messages are read.
--
-- Run this read-only inspect in the Supabase SQL editor. Do not UPDATE
-- from this file. Replace the email if you are not looking at Caleb.

-- =============================================================================
-- 1) Pairings the dashboard switcher counts (this IS the "2")
-- =============================================================================

SELECT
    p.id AS pairing_id,
    p.status,
    p.current_week,
    p.created_at,
    leader.email AS leader_email,
    leader.full_name AS leader_name,
    learner.email AS learner_email,
    learner.full_name AS learner_name
FROM pairings p
JOIN profiles leader ON leader.id = p.leader_id
LEFT JOIN profiles learner ON learner.id = p.learner_id
WHERE leader.email ILIKE '%klobe%'
   OR learner.email ILIKE '%klobe%'
   OR leader.full_name ILIKE '%caleb%'
   OR learner.full_name ILIKE '%beckett%'
ORDER BY p.created_at DESC;

-- How many rows the LearnerSwitcher badge uses for this leader:
SELECT
    leader.full_name AS leader_name,
    COUNT(*) FILTER (
        WHERE p.status IN ('active', 'pending') AND p.learner_id IS NOT NULL
    ) AS switcher_badge_learners_length
FROM pairings p
JOIN profiles leader ON leader.id = p.leader_id
GROUP BY leader.id, leader.full_name
HAVING COUNT(*) FILTER (
    WHERE p.status IN ('active', 'pending') AND p.learner_id IS NOT NULL
) > 0
ORDER BY switcher_badge_learners_length DESC;

-- =============================================================================
-- 2) Unread notifications (bell + PR #13 header pill)
-- =============================================================================

SELECT
    n.id,
    n.user_id,
    n.pairing_id,
    n.type,
    n.title,
    n.message,
    n.read,
    n.created_at,
    u.full_name AS recipient,
    u.email AS recipient_email
FROM notifications n
JOIN profiles u ON u.id = n.user_id
WHERE n.read = false
  AND (
    u.email ILIKE '%klobe%'
    OR u.full_name ILIKE '%caleb%'
  )
ORDER BY n.created_at DESC;

-- =============================================================================
-- 3) Unread messages TO the leader (what the pill should count)
--    sender != leader, is_read = false
-- =============================================================================

SELECT
    m.id,
    m.pairing_id,
    m.sender_id,
    sender.full_name AS sender_name,
    m.content,
    m.is_read,
    m.created_at,
    p.leader_id,
    leader.full_name AS leader_name
FROM messages m
JOIN pairings p ON p.id = m.pairing_id
JOIN profiles leader ON leader.id = p.leader_id
JOIN profiles sender ON sender.id = m.sender_id
WHERE m.is_read = false
  AND m.sender_id <> p.leader_id
  AND (
    leader.email ILIKE '%klobe%'
    OR leader.full_name ILIKE '%caleb%'
    OR sender.full_name ILIKE '%beckett%'
  )
ORDER BY m.created_at DESC;
