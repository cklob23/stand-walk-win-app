-- 020: Paul's Connect with Believers + Week 6 commentary and prayer
--
-- DO NOT RUN from this agent or against production from the agent.
-- Caleb: run scripts/020-precheck.sql first (read-only), then this file
-- in the Supabase SQL editor after review (staging first).
-- Weeks 1-3 stay as the live 017/018 copy. Week 4-5 titles from 019 stay
-- as they are, except Connect with Believers, which 019 left empty.
-- Pray for Your Friends, Building Bible Habits, and meeting rows are not
-- touched. The sheet has no Pray for Your Friends row, so the Week 6
-- guided-prayer coming-soon placeholder stays on that assignment.
--
-- Every update uses Q1's journey_id (found by Q1 row id or the exact
-- Nicodemus prompt). Never match by title alone across journeys.
-- Expected-count mismatches abort the single transaction.
-- Safe to re-run: sets the same commentary and prayer each time.

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
    RAISE EXCEPTION '020 aborted: assignments.journey_id is missing; refuse to match by title alone';
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
    RAISE EXCEPTION '020 aborted: Q1 not found by id or exact Nicodemus prompt';
  END IF;

  IF target_jid IS NULL THEN
    RAISE EXCEPTION '020 aborted: Q1 was found but journey_id is NULL; refuse to match by title alone';
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Connect with Believers';
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: expected 1 Connect with Believers row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Always Be Prepared';
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: expected 1 Always Be Prepared row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Create Your Friend List';
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: expected 1 Create Your Friend List row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Share Your Testimony';
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: expected 1 Share Your Testimony row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'The Hope Within You';
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: expected 1 The Hope Within You row in Q1 journey, found %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$The local church is a great place to get connected with other believers. Within that local body, it is a game changer to connect with like-minded believers and find opportunities to grow and serve. Visiting churches can be overwhelming for some personalities, but a good way to get a feel for the type of environment the church cultivates is to check their online/social media presence. You may be able to watch online services. Sometimes you have friends in the faith that you can ask about their church and you may even get an invite. Remember that the local church is a place to get connected, but it's not the life source of your walk with Christ. You must cultivate the daily priorities or RPM (read, pray, meditate) into your own life. You don't eat once or twice a week. You must not rely only upon fellowship in the local church exclusively. Work to connect with men's/women's/youth/children's ministries. Do what you can to find a place that teaches the Bible and invites you to join in their mission.$paul$,
    prayer = $paul$Heavenly Father, I desire to forsake not the assembling of myself with other believers. Order my steps to the right local body to engage with and help me to be a committed part of the body of Christ as a whole. Help me to promote unity and avoid negative talk such as gossip that doesn't build up the body of Christ. Come, Holy Spirit, and walk me through divine connection points with other believers in any way you see fit. In Jesus' name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Connect with Believers';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: Connect with Believers update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$This passage talks about being prepared to give a defense for your faith and for the hope (earnest expectation) you have about your salvation. Jay Haizlip once said, "A man with an experience can't be persuaded by a man with an opinion." Perhaps the greatest starting point of your "defense" is your story of how God found you, revealed Himself to you, and how you are currently walking out this relationship with the Creator of the universe. Of course, the Holy Bible (word of God) is the source of inspiration for doctrine, reproof, and correction in living right (2 Timothy 3:16). Keeping a clear conscience is a process of consistently evaluating your heart and motives to ensure the choices you're making align with God and they contribute to positive relationships with others. Being blameless doesn't mean you never mess up. We all do every day. Proverbs 4:23 reminds us to keep our heart with diligence. We should be prepared by knowing what God's Word says about what we believe. We need to make sure that our heart is carefully guarded to obey the number 1 and 2 commands Jesus gives so that our life's choices flow right. Love God with all of yourself and love your neighbor as yourself. (Matthew 22:37-39)$paul$,
    prayer = $paul$Heavenly Father, I pray that Your kingdom would come and Your will be done in my life. Help me to learn to understand Your holy scriptures in ways that translate into right living. Give me the words to say when I'm called upon to give a defense for the gospel and its influence in my life. Lead me and guide me into all truth and help me be an ambassador for You, aligning my life's plans with your purposes. In Jesus' name, I pray. Amen$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Always Be Prepared';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: Always Be Prepared update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$This list may be hard and it may seem to be of little meaning at first. The intentionality around writing names down helps you create a spiritual discipline of prayer and preparation for you as a laborer to help plant, water, or reap. (I Corinthians 3:5) Winning souls for the kingdom is an intentional act. (Proverbs 11:30) Oftentimes it's easier to be excited and share our testimony when we're newly saved. Our boldness seems a little more natural. Protect against complacency and intentionally write this list and learn to pray for these people on your list.$paul$,
    prayer = $paul$Heavenly Father, I pray that You would send laborers to harvest in the lives of these people on my list. I ask You to use me where I'm able to minister and sow seeds. I know You desire that none should perish and that all should come to the saving knowledge of Jesus Christ. Help me to be intentional in my prayer, testimony, and evangelistic outreach. Holy Spirit draw _____________ (insert name) to you and show them your love so that they believe and call upon you to be born again into the life only You can provide. In Jesus' name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Create Your Friend List';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: Create Your Friend List update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Writing your personal testimony gives you a chance to practice sharing your faith. It also gives you an opportunity to be intentional to insert God's word into your testimony. His word never returns void, but accomplishes what it's sent to accomplish (Isaiah 55:11). Your testimony should include what led you to recognize your need for a savior including what led up to the moment you believed in your heart and confessed with your mouth Jesus as Lord. You should be able to tell what that conversion experience looked like and felt like in your own words and how life has improved as a result. This improvement may not be filled with miraculous (it may) outcomes of temporal value, but it should include moments of memorable connection with the relationship you now have with Christ through this new life.$paul$,
    prayer = $paul$Heavenly Father, give me clarity of thought and a healthy memory of the conversion experience where You called me, drawing me to you, and help me to articulate my testimony in meaningful ways that provide hope for others, encouragement for me, and weaponized substance against the enemy. Come, Holy Spirit, and give me opportunities to share my testimony. Give me the words to say, the body language that invites, and the boldness to believe in your ability to make me useful for Your kingdom. Send me as a laborer into the harvest and show me how to till heart soil, plant, water, and harvest. In Jesus' name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'Share Your Testimony';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: Share Your Testimony update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Jesus is the Son of the One true God. God so loved us that He sent His only son into the world, not to condemn, but to save us. Our job in this life is to build a healthy relationship with God through fellowship in His word privately and publicly (church, bible studies, small groups, 1:1 discipleship), prayer (include praise, worship, thanksgiving and petitions), and meditating on the truth of His word so that our minds are renewing and we are transformed into "proof providers" that He is real. Study to show yourself able and ready to give testimony to the hope within you. Hope is birthed out of enduring trials with Godly character and intentional obedience. Most testimonies are full of success and failure, celebration and correction. Don't be discouraged as you face challenges in life and don't give up because we reap a heavenly reward if we don't quit. (Galatians 6:9)$paul$,
    prayer = $paul$Heavenly Father, I ask that You continue to work in me and mature me in faith. I know that it is You who is working in me to do what You intend to accomplish your purposes. Give me the courage to believe and be a doer of what You command and the humility to submit and repent when necessary to stay on a path of faithfulness that produces Godly fruit. Holy Spirit, my helper and friend, come alongside me and speak to me. Reveal to me what I need to be an able minister, ambassador for Christ, soldier in God's army, and servant of the King. Help me, most of all, to be your son/daughter. Lead me not into temptation, but deliver me from evil. Help me to be blessed by Your presence so I can be a blessing. It's in the mighty name of Jesus I pray, Amen$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 6
    AND title ILIKE 'The Hope Within You';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '020 aborted: The Hope Within You update expected 1 row, got %', n;
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
    'Connect with Believers',
    'Always Be Prepared',
    'Create Your Friend List',
    'Share Your Testimony',
    'The Hope Within You'
  )
ORDER BY a.week_number, a.order_index;

COMMIT;
