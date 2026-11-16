-- 022: Paul's Pray for Your Friends + Building Bible Habits copy
--
-- DO NOT RUN from this agent or against production from the agent.
-- Caleb: run scripts/022-precheck.sql first (read-only), then this file
-- in the Supabase SQL editor after review (staging first).
-- Weeks 1-6 titles already filled by 017/018/019/020 stay as they are.
-- Meeting rows are not touched. 021 is reserved by a pending daily prayer
-- branch, so this file is numbered 022.
--
-- Every update uses Q1's journey_id (found by Q1 row id or the exact
-- Nicodemus prompt). Never match by title alone across journeys.
-- Expected-count mismatches abort the single transaction.
-- Safe to re-run: sets the same commentary, prayer, and description
-- each time. Does not write the guided-prayer column.

BEGIN;

DO $$
DECLARE
  q1_id uuid := '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f';
  q1_prompt text := $paul$Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."$paul$;
  has_journey boolean;
  target_jid uuid;
  found_q1_id uuid;
  n int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignments'
      AND column_name = 'journey_id'
  ) INTO has_journey;

  IF NOT has_journey THEN
    RAISE EXCEPTION '022 aborted: assignments.journey_id is missing; refuse to match by title alone';
  END IF;

  SELECT a.id, a.journey_id
  INTO found_q1_id, target_jid
  FROM assignments a
  WHERE a.id = q1_id
     OR (
       a.week_number = 1
       AND a.title = 'Understanding Born Again'
       AND a.description = q1_prompt
     )
  ORDER BY CASE WHEN a.id = q1_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF found_q1_id IS NULL THEN
    RAISE EXCEPTION '022 aborted: Q1 not found by id or exact Nicodemus prompt';
  END IF;

  IF target_jid IS NULL THEN
    RAISE EXCEPTION '022 aborted: Q1 was found but journey_id is NULL; refuse to match by title alone';
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Pray for Your Friends';
  IF n <> 1 THEN
    RAISE EXCEPTION '022 aborted: expected 1 Pray for Your Friends row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 2
    AND title ILIKE 'Building Bible Habits';
  IF n <> 1 THEN
    RAISE EXCEPTION '022 aborted: expected 1 Building Bible Habits row in Q1 journey, found %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Prayer is a daily discipline or habit we must develop in our lives and it comes from a reverence for God and that He commands and teaches us to pray, not only for our friends, but our enemies as well (Luke 6:28). James 5:16 tells us to pray for one another and that the effective, fervent prayer of a righteous man avails much. We must take Him at His word and believe since we are the righteousness of God in Christ (not our own righteousness) our fervent prayers for our friends and even our enemies are useful and effective. Pray with intent and faithfulness for friends on a consistent basis. Prayer should include spiritual, soulish (mind, will, emotions), and bodily concerns. Praying for others' spiritual growth and health as well as their mental and emotional health is a great starting place. Isaiah 53:5 prophesies Jesus' work on the cross gave us freedom from our transgressions, iniquities, and that He purchased peace and healing through His great suffering. Pray for healing, wholeness, and peace for the whole human and believe that your prayers matter because you matter to your Creator and King. "Thy kingdom come, thy will be done on earth as it is in heaven in the lives of each friend today."$paul$,
    prayer = $paul$Heavenly Father, I come to you humbly and ask you to impact the lives of _____________ (name friend(s) here). I pray that you would fill them with the knowledge of your will for them and that you would show them your love, mercy, and grace in every area of their life. I pray for physical healing of every disease in their physical body and that you would send laborers across their paths to encourage and minister your word to them. Encourage _____________ in their spiritual walk and help them to take captive their thoughts and be submitted to the obedience of your kingdom purposes for their lives. Come Holy Spirit and move in _____________'s life in ways that help them to accomplish their purpose and live in unity with the body of Christ and in close relationship with Father, Son, and Holy Spirit. Have your way in _____________'s life and use me where you want to. I love You, Lord and I thank you for your lovingkindness that's great toward me and all my friends. In Jesus mighty name I pray, Amen.$paul$,
    description = $paul$Commit to praying daily for each person on your list. Ask God to open their hearts, provide opportunities for you to share, and give you the right words. Start this habit now and continue beyond this program.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Pray for Your Friends';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '022 aborted: Pray for Your Friends update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$There are apps you can download for free that allow you to track habits. (ie. - HabitShare allows you to share your habits with a friend and track progress) You can also use a simple method of journaling to track progress and write down key "take aways" from what you read. Paul encourages Timothy in 2 Timothy 2:15 to be diligent to study to show himself approved as a worker "rightly dividing the word of truth." Joshua 1:8, Psalms 119, and Proverbs 4:20 all give us reminders of the priority of God's word and commands and how His word gives us the truth that makes our way prosperous and it becomes health and life even to our flesh. Building bible habits demonstrates that you prioritize God's word and growing in the knowledge of God so that you can be a worker who is not ashamed of his walk. Most of us eat at least two or three times a day to nourish our bodies. Why wouldn't we set aside time(s) daily to receive nourishment for our spirit. After all, we are a spirit, we have a soul, and we live in a body. Take seriously the application of daily word study. After all, His word is spirit and it is life (John 6:63).$paul$,
    prayer = $paul$Heavenly Father, I prioritize Your holy word in my life and I ask that You reveal to me through the reading of the Bible the spirit and life that I need to make choices in my everyday life. Thank you for giving all scripture for reproof and correction so that my life is impacted by the fruitfulness of obedience to your word. Help me to study to show myself approved as a worker in Your heavenly kingdom so that my life is lived well now in ways that impact my eternity and the eternity of those I have the privilege to influence. Lead me to the truth in Your word and reveal Your character, Your power, Your love, and Your faithfulness and Your sovereignty in my daily study. Help me to desire your word as much as I desire physical food and teach me and train me in all Your ways through Your word and Spirit. May God's word be the standard by which I live my life, in Jesus name I pray, Amen.$paul$,
    description = $paul$Choose a consistent time and place for daily Bible reading. Track your consistency this week. Share any obstacles with your leader.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 2
    AND title ILIKE 'Building Bible Habits';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '022 aborted: Building Bible Habits update expected 1 row, got %', n;
  END IF;
END $$;

SELECT
  a.week_number,
  a.order_index,
  a.title,
  left(a.description, 72) AS description_prefix,
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
    'Pray for Your Friends',
    'Building Bible Habits'
  )
ORDER BY a.week_number, a.order_index;

COMMIT;
