-- 019: Paul's Week 4-5 commentary and prayer (typo and grammar pass)
--
-- DO NOT RUN from this agent or against production from the agent.
-- Caleb: run scripts/019-precheck.sql first (read-only), then this file
-- in the Supabase SQL editor after review (staging first).
-- Weeks 1-3 stay as the live 017/018 copy. Week 6 is not touched.
-- Connect with Believers and meeting rows are not touched.
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
    RAISE EXCEPTION '019 aborted: assignments.journey_id is missing; refuse to match by title alone';
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
    RAISE EXCEPTION '019 aborted: Q1 not found by id or exact Nicodemus prompt';
  END IF;

  IF target_jid IS NULL THEN
    RAISE EXCEPTION '019 aborted: Q1 was found but journey_id is NULL; refuse to match by title alone';
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Walking with Others';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Walking with Others row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Consistency in Faith';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Consistency in Faith row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Finding Likeminded Believers';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Finding Likeminded Believers row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Understanding Temptation';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Understanding Temptation row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'The Inward Battle';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 The Inward Battle row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Victory Journal';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Victory Journal row in Q1 journey, found %', n;
  END IF;

  SELECT COUNT(*) INTO n
  FROM assignments
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Winning Through Accountability';
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: expected 1 Winning Through Accountability row in Q1 journey, found %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$In Hebrews, the author encourages the believer to "hold fast to their confession." We learned that being born again happens because we believe in our heart and confess with our mouth and that we are saved by grace through faith. We must contend for the faith and hold fast or stand our ground with the confession that Jesus Christ is Lord of all and He is the Lord of our lives. We are encouraged in Hebrews 10 to consider one another to walk alongside each other in order to stir up love and good works. We are admonished to "forsake not the assembling of ourselves together" so that we can exhort and/or encourage one another. In Proverbs, we see that iron sharpens iron and in the same way a brother in Christ (or sister in Christ) who is strengthening his or her stand will "sharpen the countenance" or influence another through discussion (Amplified Bible). Life is meant to be lived in community with meaningful relationships that encourage and build up. How we talk and how we live is intended to be an encouragement and building up of self and others (Ephesians 4:29).$paul$,
    prayer = $paul$Heavenly Father, I ask You to direct my steps toward a path of growth with people who are seeking to follow You and stand strong in the power of Your resurrection. Help me to seek You with my whole heart and to join with other believers to be the ambassadors of Your heavenly kingdom on earth as we continue to grow into the mature people of God You are calling us to be. Come, Holy Spirit. Have Your way in my life and in my relationships. In Jesus' mighty name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Walking with Others';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Walking with Others update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Hebrews 11:5-6 tells us about Enoch who walked with God and was no more. His testimony was that he pleased God. Verse 6 tells us that it's impossible to please God without faith and basically tells us when we come to God we must believe that He is God and He is a rewarder of those who diligently seek Him. Faith comes by hearing and hearing by the Word of God (Romans 10:17). If we want to grow in faith and rev our spiritual engine we must consider the rhythm of our life and our intentionality around R.P.M. (read, pray, meditate). Proverbs 4:20-24 reminds us that the Word is life and health to our flesh and that we are to keep our heart. Joshua 1:8 tells us that we should meditate on God's Word day and night so that we can live according to what we learn. Praying and talking to God whether you utilize the Lord's Prayer, Psalms, and your own petitions and exaltations are important parts of growing our stance as children of God.$paul$,
    prayer = $paul$Father, direct my prayer life and my time in Your Word so that I grow in maturity and in the knowledge of God. I desire to hear Your voice and obey. Give me the humility to reverence Your voice and the courage to obey what I hear for it's in Christ's holy name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Consistency in Faith';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Consistency in Faith update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Every church is imperfect because it's full of imperfect people. Many people make excuses not to go to church due to church hurt, hypocritical behaviors they observe, or some other reason. It's important that you grow in relationship with Christ under the leadership of a Biblical Shepherd (pastor) who is praying and watching for your soul while teaching sound Biblical principles. Hebrews 13:17 teaches us to "obey our spiritual leaders and submit to them as they are keeping watch over our souls and guarding our spiritual welfare." God gifts the local body with leaders to help mature the church and its believers (Ephesians 4:11-13). We are to grow into maturity and unity as the Body of Christ. Going to a church building doesn't save you, but the Church is encouraged and strengthened as we "forsake not the assembling of ourselves together" and partake in the community of faith.$paul$,
    prayer = $paul$Father God, I ask that You order my steps and lead me to a local congregation where the pastor(s) are serious about teaching the truth of the Word of God and encourage me in my faith. Help me make connections with Godly leaders who shepherd me and help me walk free from deception. Bless me in my relationship with You and the local church as You mature me into a place where I can then be a blessing for it's in Jesus' mighty name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 4
    AND title ILIKE 'Finding Likeminded Believers';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Finding Likeminded Believers update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$James 1:12-15 tells us that we are blessed when we are steadfast (take our stand) under trials and persevere in spite of struggles. We see that God is not tempting us with evil, but we still have earthly/fleshly desires that draw us away from God's best for us. God does not tempt us with evil. This passage in James is called "the law of sin and death" in Romans 8:1. Paul talks in Romans 7 about, in our flesh, we don't do what we want and we do what we don't want to do. Paul continues in chapter 8 to tell us there is no condemnation to those who are in Christ for the law of the spirit of life in Christ Jesus has made us free from the law of sin and death. We are told in 1 Corinthians 10:13 that there is no temptation that surprised or slipped up on Jesus and that with every temptation or trial, God has made a way of escape. In this world we will have trouble/tribulation, but we can be encouraged because Christ has overcome the world (John 16:33).$paul$,
    prayer = $paul$Heavenly Father, I know that there are trials and tribulations of this world that I still struggle with in my flesh. Please walk with me and help me to walk in the Spirit so that I do not fulfill the evil desires of my flesh. Help me to be crucified with Christ yet alive according to His resurrection power in me. Come, Holy Spirit, and lead me into the pathways of life where death is defeated and I am more than a conqueror through Christ who loved me and gave Himself for me. In Jesus' name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Understanding Temptation';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Understanding Temptation update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$In the last commentary, we referenced Paul's revelation of this battle we have between our flesh and spirit (Romans 7:14-25). We are still living in a carnal body and in that flesh "nothing good dwells". There is a battle going on within us where, with our mind, we serve the law of God and with our flesh, the law of sin (verse 25). Galatians 5:16-26 exposes us to this idea of "walking in the Spirit." Notice in the NKJV, the word Spirit is capitalized. It's referencing the person of the Trinity called the Holy Spirit. Being led by the Spirit will produce the fruits of the Spirit (love, joy, peace, longsuffering (patience), kindness, goodness, faithfulness, gentleness, and self-control (temperance)). Our inward battle is one where we work to renew our mind by God's Word according to Romans 12:1-2 where we decide as Paul encourages to present our bodies a "living sacrifice" and by a choice of our mind (reasonable service) we demonstrate a transformative process not conforming to the world around us by renewing our minds. Jesus said that the flesh profits nothing, but His Word is spirit and life (John 6:63). Much like the metaphor of feeding the wolves where the one you feed the most is going to dominate, we must win the inward battle by intentionally spending time in God's Word and prayer so that we are constantly feeding our spirit man as opposed to fanning the flames of our fleshly desires. Walk in the Spirit, be led by the Spirit, be filled with the Spirit... all of these phrases remind us that carnally minded living will keep us bound to the law of sin and death. If we are spiritually minded, we will experience life and peace, even in the struggles of everyday life and the battle within.$paul$,
    prayer = $paul$Heavenly Father, I find myself doing what I don't want to do and what I know I should prioritize and do, I fail to do. I confess my sins and ask You to forgive me and cleanse me from any unrighteousness in my life. Lead me by Your Spirit into a life of obedience and walking in this life producing the fruit of Your Holy Spirit. Help me to intentionally put to death the deeds of the carnal nature by renewing my mind according to Your Word. I desire to walk in the Spirit so that I do not fulfill the lust of the flesh. I thank You for Your grace and faithfulness in my life. Come, Holy Spirit, and influence my thoughts and choices so that the life I lead gives glory to Your Holy name for it's in the mighty name of Jesus I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'The Inward Battle';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: The Inward Battle update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Habakkuk 2:2 teaches us the importance of writing the vision so those who read it can run with vision. Journaling will add intentionality to your life of purpose and help you write the vision and to make it plain so that you can live on purpose. Proverbs 29:18 warns us, "where there is not vision, the people perish" or are unrestrained/undisciplined. God's Word is ultimately the vision we should run with. As you read God's Word and consider its impact on your life, write what you are learning and committing to. Remember that we don't fight for victory, but from Victory. We are more than conquerors through Christ and we are His workmanship, created in Christ unto good works. Keep a victory journal and give Him praise as He gives you revelation and victory in your daily walk.$paul$,
    prayer = $paul$Father in heaven, hallowed be Your name. I pray that Your kingdom come and Your will be done in my life on earth as You've purposed in heaven. Help me to get a vision of who You are and who You've designed me to be. Help me to recall clearly what You speak to me and to "write the vision" and use my Victory journal as a testimonial transcript of this awesome new life You've given me through Your Son and the friendship with my Comforter, the Holy Spirit. Amen$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Victory Journal';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Victory Journal update expected 1 row, got %', n;
  END IF;

  UPDATE assignments
  SET
    commentary = $paul$Accountability is all about loving relationships where other brothers and sisters in Christ are encouraging you in the Lord and helping you to "sharpen the saw" of your spiritual walk. Consider Proverbs 17:17 where "a friend loves at all times, and a brother is born for adversity." May we consider what love means. Perhaps a good definition of this "agape" love is "willing the good of others" or "the willingness to serve and sacrifice for others because you value them." One way to strengthen your stance is to walk alongside brothers and sisters in Christ with the intent to "confess your faults one to another") and encourage one another as we studied previously in Hebrews 10:23-25. James 5:16 tells us that we are to confess our sins/faults and pray for one another. It also tells us that the "heartfelt and persistent prayer of a righteous man (believer) is able to accomplish much" (Amplified Bible). Build relationships with others you can confess faults to and pray for one another in real authentic relationships.$paul$,
    prayer = $paul$Heavenly Father, I come to You in prayer asking that You order my steps to cross paths with believers who can encourage me and pray for me. Help me to confess my faults to friends who love me and will pray for me because they desire Your will and purposes be manifested in my life. Help me to do the same for them. Order my steps and use me to be a friend and to build healthy relationships of accountability and growth. Build the unity of Your Body and help me to be obedient to play my part in the lives of all those You send my way. I thank You that I have these petitions I ask as I ask in faith believing that You are able to do exceedingly and abundantly beyond what I've asked or thought. In Jesus' name I pray, Amen.$paul$
  WHERE journey_id IS NOT DISTINCT FROM target_jid
    AND week_number = 5
    AND title ILIKE 'Winning Through Accountability';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '019 aborted: Winning Through Accountability update expected 1 row, got %', n;
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
    'Walking with Others',
    'Consistency in Faith',
    'Finding Likeminded Believers',
    'Understanding Temptation',
    'The Inward Battle',
    'Victory Journal',
    'Winning Through Accountability'
  )
ORDER BY a.week_number, a.order_index;

COMMIT;
