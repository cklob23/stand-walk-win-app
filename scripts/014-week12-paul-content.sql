-- 014: Paul's Week 1 and Week 2 commentary, prayer, and Question 5
--
-- SUPERSEDED by 017-paul-journey-content.sql (full sheet + grammar pass).
-- Do not run 014 after 017; 017 is the copy to apply.
--
-- DO NOT RUN from this PR or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
-- Run AFTER 013-assignment-commentary-prayer.sql.
--
-- Source of truth for ids: live-week12-assignments.csv (prod New Believer
-- Foundations rows). Repo seeds 002/003 are stale.
-- Text is Paul's wording from content.json (typos already fixed).
--
-- Row-to-id mapping (spreadsheet numbers, pending Paul's confirmation):
--
-- Live Q2 is the wind question (John 3:8). Spreadsheet "Prayer for Question 1"
-- is about the wind, so the themes look offset. The spec maps by number.
-- Confirm with Paul if prayer 1 should move to Q2.
--
--   Q1 7c60bfec-3e9b-4900-813c-4e3cbeafcf4f  live Nicodemus / born again
--      commentary row 13
--      prayer      row 7 (labeled Prayer for Question 1)
--   Q2 d2a6bbce-9068-4871-9ca2-7999cf4d54c5  live John 3:8 wind
--      commentary row 14
--      prayer      row 6 (salvation prayer; row 8 was a placeholder)
--      prayer_note same-prayer cross reference
--   Q3 92d35e76-8587-4e43-9db5-ad2a4d4b9c5a  live John 3:14-15
--      commentary row 15
--      prayer      row 9
--   Q4 cacc072a-ee39-4ea8-bf16-ebbf4450a195  live John 3:16
--      commentary row 16
--      prayer      row 10
--   Q5 inserted as next Understanding Born Again question (order_index 5)
--      description row 2
--      commentary  row 3 then row 17 (both kept, short first)
--      prayer      row 11
--   Your Salvation Story     b3073316-a82e-45ff-99e1-ab3a334799e4
--      commentary row 19
--      prayer      none yet (Paul still writing)
--   The Meaning of Baptism   dd10ef64-f38d-4f84-b93a-31f601e9f812
--      commentary row 21
--      prayer      row 22
--   Prayer: Talking with Your Father  5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad
--      guided_prayer row 6
--      description updated to the read-and-pray instruction
--   Learning to Pray         2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e
--      commentary     row 25
--      guided_prayer  row 24 (reading type; not a Prayer card)
--   Understanding Prayer     63bef6fa-c0c2-492b-9fa2-65a9a4f23645
--      guided_prayer  empty string (coming-soon slot)
--      commentary/prayer none yet (row 27 blank)
--
-- No new Week 2 assignment rows. Weeks 3-6 prayer-type rows stay null
-- and show the coming-soon card in the app.
--
-- Q5 grouping: Understanding Born Again stays one group. Progress is stored
-- on the primary row (Q1). Adding Q5 does not change the Week 1 group count
-- and does not re-lock pairings already past Week 1. No auto-complete is
-- needed. See the note at the bottom of this file.

BEGIN;

-- ---------------------------------------------------------------------------
-- Insert Q5 after live Q1-Q4. Shift later Week 1 items by +1 so Q5 stays
-- grouped with Understanding Born Again (order_index 5).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  q5_id uuid := 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04';
  q5_text text := $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$;
  jid uuid;
  already boolean;
BEGIN
  SELECT journey_id
  INTO jid
  FROM assignments
  WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f';

  SELECT EXISTS (
    SELECT 1
    FROM assignments
    WHERE id = q5_id
       OR (
         week_number = 1
         AND title = 'Understanding Born Again'
         AND description = q5_text
         AND journey_id IS NOT DISTINCT FROM jid
       )
  ) INTO already;

  IF NOT already THEN
    -- Two-step bump avoids unique (journey, week, order_index) collisions.
    UPDATE assignments
    SET order_index = order_index + 100
    WHERE id IN (
      'b3073316-a82e-45ff-99e1-ab3a334799e4',
      'dd10ef64-f38d-4f84-b93a-31f601e9f812',
      '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad',
      'c69d8de5-1bfd-493e-84b4-532c01786866'
    )
      AND week_number = 1
      AND order_index >= 5;

    UPDATE assignments
    SET order_index = order_index - 99
    WHERE id IN (
      'b3073316-a82e-45ff-99e1-ab3a334799e4',
      'dd10ef64-f38d-4f84-b93a-31f601e9f812',
      '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad',
      'c69d8de5-1bfd-493e-84b4-532c01786866'
    )
      AND week_number = 1
      AND order_index >= 105;

    INSERT INTO assignments (
      id,
      week_number,
      title,
      description,
      assignment_type,
      order_index,
      journey_id
    )
    VALUES (
      q5_id,
      1,
      'Understanding Born Again',
      q5_text,
      'reading',
      5,
      jid
    );
  END IF;
END $$;

-- Q1: live Nicodemus / born again. Commentary 1. Prayer 1 (row 7).
UPDATE assignments
SET
  commentary = $paul$Adam ate of the fruit and died in that he was separated from open communion and fellowship with God. That death was rectified in the "2nd Adam" who is Christ Jesus. Jesus, when He said, "It is finished" accomplished the work of destroying the enmity between God and man. When we are born again, we are crucified with Christ, yet we are risen into a newness of life as we have become a new creation according to Galatians 6:15 and 2 Corinthians 5:17.$paul$,
  prayer = $paul$Heavenly Father, I know that the wind blows and we can't see it; however, we see its effects. Open my eyes to see your working and to recognize your life in my life. May your love and life light the candle of my heart so that I am recreated in Christ and able to hear your voice and obey. Show me what to do and how to live. Deliver me from evil and set my feet on a solid path consistent with Your Word and your purposes for my life. It's in Jesus' name I pray, Amen.$paul$
WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f';

-- Q2: live wind (John 3:8). Commentary 2. Salvation prayer (row 6) plus note.
UPDATE assignments
SET
  commentary = $paul$The word "spirit" in the Old Testament is Ruwah or ruwach and in the New Testament, it is pneuma. We know that wind is air or breath. All life exists because it breathes and has breath. Psalms teaches us to "let everything that has breath praise the Lord." We can't see the wind, but we experience its effects. May we recognize the breath of God, the finger of God, and the Spirit of God by faith, not by sight.$paul$,
  prayer = $paul$Heavenly Father, I thank you that You loved me so much that you sent your only Son, not to condemn me, but to allow me to be in right relationship with you through the blood of Jesus. Jesus, I repent of all of my sins and ask you to forgive me for not following you. I believe in my heart that You are the Christ, the Son of God and that You died for the sins of the world and that You rose again. I ask you to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation and help me to follow you and testify of your good working in my life. In Jesus' mighty name, I pray. Amen$paul$,
  prayer_note = $paul$Same prayer as this week's guided prayer in Prayer: Talking with Your Father.$paul$
WHERE id = 'd2a6bbce-9068-4871-9ca2-7999cf4d54c5';

-- Q3: lifted up (John 3:14-15). Commentary 3. Light / Spirit prayer (row 9).
UPDATE assignments
SET
  commentary = $paul$John 1:4 teaches us that "in Him was life and that life was the light of man." His light overcomes darkness, including the darkness in our heart without His breath or life. When we believe in Him and confess that with our mouth, we are living in the purposed design. He is lifted up when we live in obedience to His calling and we believe. Believe means to "trust in, cling to, and rely on." May we believe and pray like the father with the son possessed with a demon, "help thou my unbelief."$paul$,
  prayer = $paul$Heavenly Father, I ask that the life of your Holy Spirit breathe in me in such a way as to cause me to reflect the light of your glory in my life. I know that in myself I am not worthy of your presence and might, but through Christ in me I have the hope of glory. Help me to be the salt and light you've called me to become so that your life is lifted up in mine. Come Holy Spirit and have your way in me today!$paul$
WHERE id = '92d35e76-8587-4e43-9db5-ad2a4d4b9c5a';

-- Q4: John 3:16 trusting Jesus. Commentary 4. Not-condemned prayer (row 10).
UPDATE assignments
SET
  commentary = $paul$Our trusting and believing is a manifestation of His grace and His moving in our hearts. We can't see God, but Jesus tells Thomas to experience with his senses the reality of Jesus' nail holes and the spear in His side. He then tells Thomas that he's blessed having been able to see and believe, but that "blessed are they who do not see, yet believe." We may not be able to see with our eyes and experience with our senses the reality of Christ and His working in us, but believing will be seeing if we trust God and lean not on our own understanding (Proverbs 3:5-6).$paul$,
  prayer = $paul$Father God, I bless your holy name that is above all other names. I believe you sent your only Son, Jesus, to be the sacrificial lamb of God for my forgiveness. I confess my sins openly before you and ask you to forgive me of my sins and cleanse me from all unrighteousness. I thank you that you loved me so much that Jesus came to give me life and that I am not condemned. Come Holy Spirit and fill me to be useful in your kingdom today.$paul$
WHERE id = 'cacc072a-ee39-4ea8-bf16-ebbf4450a195';

-- Q5: Romans 10:8-10. Both commentaries (row 3 then row 17). Prayer row 11.
UPDATE assignments
SET
  commentary = $paul$It's with our heart that we believe and with the mouth we confess. The Bible teaches us to keep our heart and it teaches us about the importance of our words. It's important that we intentionally feed our heart the truth of the gospel (good news) because "out of the abundance of the heart, the mouth speaks". (Matt. 12:34 and Luke 6:45).

Romans 10:9-10 is a fundamental scripture that reveals what the Gospel is and how we are to respond. We are to believe with our heart. Proverbs 4:23 teaches us to "keep your heart with all diligence for out of it are the issues of life." We believe with our heart and we confess with our mouth. The words of our mouth are a common theme in God's word. The power of life and death are in the tongue. James tells us that it's like a rudder that steers our ship or a bit in the horse's mouth that controls his direction. May we believe in our hearts the truth of God's word and confess with our mouth the great and glorious news of the Gospel that Jesus died and was raised for our justification so that we might become the children of God.$paul$,
  prayer = $paul$Heavenly Father, I believe with all of my heart that you are God and that Jesus Christ is the fulfillment of your purpose in earth and that He came, lived, and died for the sins of the whole world. I believe that He was raised from the dead and that the same Holy Spirit working in Him to raise Him dwells in me. I believe with my heart and, as a result of this belief, I confess with my mouth that Jesus Christ is Lord of all and He is Lord of my life. Help me to keep my heart unspotted from the world and to live in ways that honor You, Lord.$paul$
WHERE week_number = 1
  AND title = 'Understanding Born Again'
  AND description = $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$;

-- Your Salvation Story: commentary row 19. No prayer.
UPDATE assignments
SET
  commentary = $paul$Revelation 12:11 tells how believers overcome "by the blood of the Lamb and by the word of their testimony." Write down your testimony of being "born again" and asking Jesus to make you a new creation. You are re-created in Christ Jesus and that is a story worthy of sharing. Be encouraged to share the testimony of your salvation and your walk with Christ. Jay Haizlip once said, "A man with an experience can't be persuaded by a man with an opinion." Your story matters. When times get hard, remember His love and His working in your life.$paul$
WHERE id = 'b3073316-a82e-45ff-99e1-ab3a334799e4';

-- The Meaning of Baptism: commentary row 21, prayer row 22.
UPDATE assignments
SET
  commentary = $paul$Water Baptism is an outward representation of what we believe has happened on the inside when we asked Jesus to come into our life and become Lord. We are buried with Him in Baptism represented by going under the water and we are raised to newness of life as we rise out of the water in celebration of new life in Christ. Baptism was an act continued by the early church even to represent repentance. John the Baptist baptized Jesus and after the church was formed, the apostles baptized regularly new converts to the faith. The book of Acts records baptism throughout; however, baptism is not a work that saves nor is a failure to do so an impediment to one's salvation. Consider the thief on the cross to whom Jesus said, "today you will be with me in paradise." Our salvation is a result of the Holy Spirit's prompting our heart to believe and our confession of Jesus as Lord. Consider Acts 2:38, Romans 6:4, and Colossians 2:12$paul$,
  prayer = $paul$Heavenly Father, I pray that you would continuously remind me to be crucified with Christ and risen with Him in this new life You have granted. Just as there is no breathing and life under the water, I pray that I would be immediately rescued from drowning in the sorrows of daily life as I'm energized and given life by your Spirit to live for you. Come Holy Spirit and raise me today into the newness of life only your resurrection life can provide.$paul$
WHERE id = 'dd10ef64-f38d-4f84-b93a-31f601e9f812';

-- Week 1 guided prayer on the prayer-type assignment.
UPDATE assignments
SET
  description = $paul$Read slowly and pray this out loud or in your heart.$paul$,
  guided_prayer = $paul$Heavenly Father, I thank you that You loved me so much that you sent your only Son, not to condemn me, but to allow me to be in right relationship with you through the blood of Jesus. Jesus, I repent of all of my sins and ask you to forgive me for not following you. I believe in my heart that You are the Christ, the Son of God and that You died for the sins of the world and that You rose again. I ask you to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation and help me to follow you and testify of your good working in my life. In Jesus' mighty name, I pray. Amen$paul$,
  prayer = NULL
WHERE id = '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad';

-- Week 2 Learning to Pray: commentary row 25, guided prayer row 24.
-- No new Week 2 row. The reading card keeps its live description.
UPDATE assignments
SET
  commentary = $paul$The Lord's Prayer in Matthew 6 is a wonderful model of prayer. It begins with "Our Father in heaven, hallowed be your name." This expresses reverence and "fear of God" as well as worship. We pray that His Kingdom come and His will be done on earth as it is in heaven. We are praying that heavenly influence be welcomed into our lives. Prayer for provision is next followed by forgiveness and the intent to forgive. We then pray for our leading to be by God, not to temptation, but deliverance from evil. Mark Rutland wrote a book about the Lord's prayer and Psalms 23. In it, he talks about how the Lord's prayer takes about 21 seconds to pray and it can be a healthy prayer. Prayer is simply our talking and communing with God. Don't overthink it. Submit your words and heart to the Lord and ask for what you think you need and allow Him to grow in your prayer life as you grow in the knowledge of His word and will for your life. Perhaps the most important aspect of prayer is the understanding and belief that God desires we pray and He hears us. Hebrews 11:6 expresses that walking with God requires that we believe that He is God and He rewards us when we diligently seek Him. Prayer is a primary way we "diligently seek Him."$paul$,
  guided_prayer = $paul$Heavenly Father, I ask you to help guide me to pray without ceasing and to continuously pray with thanksgiving and praise to the One who is able to do exceedingly and abundantly above all I could ask or think. May your kingdom purposes come and be carried out in my life as I live in obedience to Your word and Your Holy Spirit promptings. Lead me not into temptations that distract me from Your design and deliver me from evil. Forgive me of my trespasses and missteps as I forgive those who do wrong to me. Just as I have been forgiven, I will walk in forgiveness toward others.$paul$,
  prayer = NULL
WHERE id = '2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e';

-- Week 2 Understanding Prayer: empty guided_prayer reserves coming soon.
UPDATE assignments
SET
  guided_prayer = ''
WHERE id = '63bef6fa-c0c2-492b-9fa2-65a9a4f23645';

-- Preview the rows this script touches.
SELECT
  a.id,
  a.week_number,
  a.order_index,
  a.assignment_type,
  a.title,
  left(a.description, 80) AS description_prefix,
  left(coalesce(a.commentary, ''), 60) AS commentary_prefix,
  left(coalesce(a.prayer, ''), 60) AS prayer_prefix,
  left(coalesce(a.guided_prayer, ''), 60) AS guided_prayer_prefix,
  a.prayer_note
FROM assignments a
WHERE a.id IN (
  '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f',
  'd2a6bbce-9068-4871-9ca2-7999cf4d54c5',
  '92d35e76-8587-4e43-9db5-ad2a4d4b9c5a',
  'cacc072a-ee39-4ea8-bf16-ebbf4450a195',
  'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04',
  'b3073316-a82e-45ff-99e1-ab3a334799e4',
  'dd10ef64-f38d-4f84-b93a-31f601e9f812',
  '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad',
  '2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e',
  '63bef6fa-c0c2-492b-9fa2-65a9a4f23645'
)
   OR (
     a.week_number = 1
     AND a.title = 'Understanding Born Again'
     AND a.description = $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$
   )
ORDER BY a.week_number, a.order_index;

COMMIT;

-- Q5 and learners already past Week 1
-- ----------------------------------
-- groupAssignments() merges Understanding Born Again rows into one group.
-- Progress and week unlock count the primary row (Q1), not each question.
-- Adding Q5 therefore:
--   * does not change Week 1 from N/N to 4/5
--   * does not re-lock pairings with current_week > 1
--   * leaves existing assignment_progress and prayer_journal untouched
-- Learners who already completed the group stay complete. They will see Q5
-- if they reopen Week 1, but they are not asked to re-complete the card.
--
-- If product later tracks one progress row per question, auto-complete Q5
-- for pairings already beyond week 1 with something like:
--
-- INSERT INTO assignment_progress (pairing_id, assignment_id, user_id, status, completed_at)
-- SELECT p.id, q5.id, p.learner_id, 'completed', now()
-- FROM pairings p
-- JOIN assignments q5
--   ON q5.description = $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$
--  AND q5.week_number = 1
--  AND q5.title = 'Understanding Born Again'
-- JOIN assignment_progress ap
--   ON ap.pairing_id = p.id
--  AND ap.assignment_id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
--  AND ap.user_id = p.learner_id
--  AND ap.status = 'completed'
-- WHERE p.current_week > 1
--   AND p.learner_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM assignment_progress x
--     WHERE x.pairing_id = p.id
--       AND x.assignment_id = q5.id
--       AND x.user_id = p.learner_id
--   );
--
-- Do not run that insert unless progress is changed to count Q5 separately.
