-- 018 precheck (read-only). Run this first in the Supabase SQL editor.
-- Does not write. Safe on prod. Use it to see how many journeys exist and
-- whether any other journey shares the Week 1-3 titles 018 will touch.
--
-- Q1 is found by live id or the exact Nicodemus prompt. 018 then uses
-- that row's journey_id and never matches by title alone.

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

-- Titles 018 will touch that also exist on a different journey
SELECT
  a.journey_id,
  j.name AS journey_name,
  a.week_number,
  a.title,
  COUNT(*) AS row_count
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.title IN (
    'Understanding Born Again',
    'Your Salvation Story',
    'The Meaning of Baptism',
    'Prayer: Talking with Your Father',
    'Learning to Pray',
    'Understanding Prayer',
    'Beginning Bible Study',
    'The Armor of God',
    'Turning from the Old Direction',
    'Making a Stand Plan',
    'Prayer for Strength'
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

-- Other-journey Week 1-3 title rows that already have commentary or prayer.
-- If the older 017 overwrote another journey on prod, these will be populated.
SELECT
  a.journey_id,
  j.name AS journey_name,
  COUNT(*) AS populated_row_count
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.title IN (
    'Understanding Born Again',
    'Your Salvation Story',
    'The Meaning of Baptism',
    'Prayer: Talking with Your Father',
    'Learning to Pray',
    'Understanding Prayer',
    'Beginning Bible Study',
    'The Armor of God',
    'Turning from the Old Direction',
    'Making a Stand Plan',
    'Prayer for Strength'
  )
  AND (a.commentary IS NOT NULL OR a.prayer IS NOT NULL)
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
GROUP BY a.journey_id, j.name
ORDER BY a.journey_id;

-- Sample of those other-journey rows that still carry old 017 wording
SELECT
  a.journey_id,
  j.name AS journey_name,
  a.week_number,
  a.title,
  a.order_index,
  left(coalesce(a.commentary, a.prayer, a.prayer_note, ''), 140) AS old_wording_sample
FROM assignments a
LEFT JOIN journeys j ON j.id = a.journey_id
WHERE a.title IN (
    'Understanding Born Again',
    'Your Salvation Story',
    'The Meaning of Baptism',
    'Prayer: Talking with Your Father',
    'Learning to Pray',
    'Understanding Prayer',
    'Beginning Bible Study',
    'The Armor of God',
    'Turning from the Old Direction',
    'Making a Stand Plan',
    'Prayer for Strength'
  )
  AND (a.commentary IS NOT NULL OR a.prayer IS NOT NULL)
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
  AND (
    coalesce(a.commentary, '') LIKE '%light of man%'
    OR coalesce(a.commentary, '') LIKE '%2nd Adam%'
    OR coalesce(a.commentary, '') LIKE '%Ruwah or ruwach%'
    OR coalesce(a.commentary, '') LIKE '%Help thou my unbelief%'
    OR coalesce(a.commentary, '') LIKE '%spear in His side%'
    OR coalesce(a.commentary, '') LIKE '%Matt. 12:34%'
    OR coalesce(a.commentary, '') LIKE '%Acts 3:19%'
    OR coalesce(a.commentary, '') LIKE '%body of sin%'
    OR coalesce(a.commentary, '') LIKE '%gifted you within%'
    OR coalesce(a.commentary, '') LIKE '%Phil. 2:12-13%'
    OR coalesce(a.commentary, '') LIKE '%very unique%'
    OR coalesce(a.prayer_note, '') LIKE '%This is the Salvation prayer%'
    OR coalesce(a.prayer, '') LIKE '%mighty name, I pray%'
    OR coalesce(a.prayer, '') LIKE '%I pray, Amen.%'
    OR coalesce(a.prayer, '') LIKE '%King of Kings%'
    OR coalesce(a.prayer, '') LIKE '%Father in Heaven%'
    OR coalesce(a.guided_prayer, '') LIKE '%draw near to God%'
    OR coalesce(a.guided_prayer, '') LIKE '%dying for our sins%'
  )
ORDER BY a.journey_id, a.week_number, a.order_index;

-- Week 1 order in Q1's journey (expect Q5 at 5, Salvation 6, Baptism 7, Prayer 8, Meeting 9)
SELECT
  a.order_index,
  a.title,
  a.assignment_type,
  left(a.description, 72) AS description_prefix
FROM assignments a
WHERE a.week_number = 1
  AND a.journey_id IS NOT DISTINCT FROM (
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
ORDER BY a.order_index;
