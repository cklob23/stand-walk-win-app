-- 020 precheck (read-only). Run this first in the Supabase SQL editor.
-- Does not write. Safe on prod. Use it to see how many journeys exist and
-- whether any other journey shares the titles 020 will touch.
--
-- Q1 is found by live id or the exact Nicodemus prompt. 020 then uses
-- that row's journey_id and never matches by title alone.
-- Pray for Your Friends, Building Bible Habits, and meetings are listed
-- only as a snapshot. 020 does not write those rows.

-- How many journeys exist
SELECT COUNT(*) AS journey_count FROM journeys;

-- Where Q1 lives
SELECT
  a.id,
  a.journey_id,
  j.name AS journey_name,
  a.week_number,
  a.order_index,
  left(a.description, 80) AS description_prefix
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
   OR (
     a.week_number = 1
     AND a.title = 'Understanding Born Again'
     AND a.description = $paul$Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."$paul$
   )
ORDER BY CASE WHEN a.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f' THEN 0 ELSE 1 END;

-- Titles 020 will touch that also exist on a different journey
SELECT
  a.journey_id,
  j.name AS journey_name,
  a.week_number,
  a.title,
  COUNT(*) AS row_count
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.title IN (
    'Connect with Believers',
    'Always Be Prepared',
    'Create Your Friend List',
    'Share Your Testimony',
    'The Hope Within You'
  )
  AND a.journey_id IS DISTINCT FROM (
    SELECT q1.journey_id
    FROM assignments q1
    WHERE q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
       OR (
         q1.week_number = 1
         AND q1.title = 'Understanding Born Again'
         AND q1.description = $paul$Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."$paul$
       )
    ORDER BY CASE WHEN q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f' THEN 0 ELSE 1 END
    LIMIT 1
  )
GROUP BY a.journey_id, j.name, a.week_number, a.title
ORDER BY a.journey_id, a.week_number, a.title;

-- Q1-journey rows 020 will fill
SELECT
  a.week_number,
  a.order_index,
  a.title,
  a.assignment_type,
  (a.commentary IS NOT NULL AND btrim(a.commentary) <> '') AS commentary_populated,
  (a.prayer IS NOT NULL AND btrim(a.prayer) <> '') AS prayer_populated,
  left(coalesce(a.commentary, ''), 48) AS commentary_prefix,
  left(coalesce(a.prayer, ''), 48) AS prayer_prefix
FROM assignments a
WHERE a.journey_id IS NOT DISTINCT FROM (
    SELECT q1.journey_id
    FROM assignments q1
    WHERE q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
       OR (
         q1.week_number = 1
         AND q1.title = 'Understanding Born Again'
         AND q1.description = $paul$Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."$paul$
       )
    ORDER BY CASE WHEN q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f' THEN 0 ELSE 1 END
    LIMIT 1
  )
  AND a.title IN (
    'Connect with Believers',
    'Always Be Prepared',
    'Create Your Friend List',
    'Share Your Testimony',
    'The Hope Within You'
  )
ORDER BY a.week_number, a.order_index;

-- Snapshot only: Pray for Your Friends, Building Bible Habits, meetings.
-- 020 must not change these. Expect guided_prayer still empty on
-- Pray for Your Friends (Week 6 coming-soon placeholder).
SELECT
  a.week_number,
  a.order_index,
  a.title,
  a.assignment_type,
  (a.commentary IS NOT NULL AND btrim(a.commentary) <> '') AS commentary_populated,
  (a.prayer IS NOT NULL AND btrim(a.prayer) <> '') AS prayer_populated,
  (a.guided_prayer IS NOT NULL AND btrim(a.guided_prayer) <> '') AS guided_prayer_populated
FROM assignments a
WHERE a.journey_id IS NOT DISTINCT FROM (
    SELECT q1.journey_id
    FROM assignments q1
    WHERE q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
       OR (
         q1.week_number = 1
         AND q1.title = 'Understanding Born Again'
         AND q1.description = $paul$Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."$paul$
       )
    ORDER BY CASE WHEN q1.id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f' THEN 0 ELSE 1 END
    LIMIT 1
  )
  AND (
    a.title IN ('Pray for Your Friends', 'Building Bible Habits')
    OR a.assignment_type = 'meeting'
  )
ORDER BY a.week_number, a.order_index;
