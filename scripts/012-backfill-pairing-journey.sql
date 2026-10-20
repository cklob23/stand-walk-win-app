-- 012: Backfill pairings.journey_id for app-created rows that have none
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
--
-- App-created pairings (onboarding / "Create pairing code") used to insert
-- without journey_id. Graduate then failed with "Pairing is missing a journey".
-- New inserts set the default journey. This script fills existing nulls only.
--
-- Resolution order matches lib/default-journey.ts:
--   1. journeys.is_default
--   2. name = 'New Believer Foundations'
--   3. the only available journey, if there is exactly one

UPDATE pairings p
SET journey_id = d.id
FROM (
  SELECT id
  FROM journeys
  WHERE is_default IS TRUE
  ORDER BY created_at
  LIMIT 1
) d
WHERE p.journey_id IS NULL;

UPDATE pairings p
SET journey_id = d.id
FROM (
  SELECT id
  FROM journeys
  WHERE lower(btrim(name)) = lower('New Believer Foundations')
  ORDER BY created_at
  LIMIT 1
) d
WHERE p.journey_id IS NULL;

UPDATE pairings p
SET journey_id = d.id
FROM (
  SELECT id
  FROM journeys
  WHERE COALESCE(is_available, TRUE) IS TRUE
) d
WHERE p.journey_id IS NULL
  AND (SELECT count(*) FROM journeys WHERE COALESCE(is_available, TRUE) IS TRUE) = 1;
