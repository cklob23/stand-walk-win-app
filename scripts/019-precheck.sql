-- 019 precheck (read-only). Run this first in the Supabase SQL editor.
-- Does not write. Safe on prod. Use it to see how many journeys exist and
-- whether any other journey shares the Week 4-5 titles 019 will touch.
--
-- Q1 is found by live id or the exact Nicodemus prompt. 019 then uses
-- that row's journey_id and never matches by title alone.
-- Week 6 titles and Connect with Believers are listed only as a snapshot.
-- 019 does not write those rows.

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

-- Titles 019 will touch that also exist on a different journey
SELECT
  a.journey_id,
  j.name AS journey_name,
  a.week_number,
  a.title,
  COUNT(*) AS row_count
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.title IN (
    'Walking with Others',
    'Consistency in Faith',
    'Finding Likeminded Believers',
    'Understanding Temptation',
    'The Inward Battle',
    'Victory Journal',
    'Winning Through Accountability'
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

-- Q1-journey Week 4-5 rows 019 will fill (expect commentary and prayer empty today)
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
    'Walking with Others',
    'Consistency in Faith',
    'Finding Likeminded Believers',
    'Understanding Temptation',
    'The Inward Battle',
    'Victory Journal',
    'Winning Through Accountability'
  )
ORDER BY a.week_number, a.order_index;

-- Snapshot only: Week 4 Connect with Believers, meetings, and Week 6.
-- 019 must not change these. Expect commentary and prayer still empty.
SELECT
  a.week_number,
  a.order_index,
  a.title,
  a.assignment_type,
  (a.commentary IS NOT NULL AND btrim(a.commentary) <> '') AS commentary_populated,
  (a.prayer IS NOT NULL AND btrim(a.prayer) <> '') AS prayer_populated
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
    a.title = 'Connect with Believers'
    OR a.assignment_type = 'meeting'
    OR a.week_number = 6
  )
ORDER BY a.week_number, a.order_index;
