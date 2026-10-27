-- 017: Paul's Week 1-3 commentary and prayer (full grammar pass)
--
-- DO NOT RUN from this agent or against production from the agent.
-- Caleb: apply this in the Supabase SQL editor after review (staging first).
-- Run AFTER 013-assignment-commentary-prayer.sql. Safe to re-run after 014.
--
-- Matches live prod rows by id when present, and also matches by
-- week + title so fresh 003 seeds pick up the same copy.
-- Question 5 is inserted once per journey if it is missing.
--
-- Armor of God, Turning from the Old Direction, Making a Stand Plan, and
-- Prayer for Strength stay on Week 3. Paul labeled them Week 2 in the
-- sheet; the app already has those titles on Week 3.

BEGIN;

-- Q5 after live Q1-Q4. Same id as 014 so a second run is a no-op.
DO $$
DECLARE
  q5_id uuid := 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04';
  q5_text text := $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$;
  has_journey boolean;
  already boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assignments'
      AND column_name = 'journey_id'
  ) INTO has_journey;

  SELECT EXISTS (
    SELECT 1 FROM assignments
    WHERE id = q5_id
       OR (
         week_number = 1
         AND title = 'Understanding Born Again'
         AND description = q5_text
       )
  ) INTO already;

  IF already THEN
    RETURN;
  END IF;

  IF has_journey AND EXISTS (
    SELECT 1 FROM assignments WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
  ) THEN
    EXECUTE $q5$
      UPDATE assignments
      SET order_index = order_index + 100
      WHERE week_number = 1
        AND journey_id IS NOT DISTINCT FROM (
          SELECT journey_id FROM assignments
          WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
        )
        AND order_index >= 5
        AND id <> 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04'
    $q5$;

    EXECUTE $q5$
      UPDATE assignments
      SET order_index = order_index - 99
      WHERE week_number = 1
        AND journey_id IS NOT DISTINCT FROM (
          SELECT journey_id FROM assignments
          WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
        )
        AND order_index >= 105
    $q5$;

    EXECUTE $q5$
      INSERT INTO assignments (
        id, week_number, title, description, assignment_type, order_index, journey_id
      )
      SELECT
        'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04',
        1,
        'Understanding Born Again',
        $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$,
        'reading',
        5,
        journey_id
      FROM assignments
      WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
    $q5$;
  ELSIF EXISTS (
    SELECT 1 FROM assignments
    WHERE week_number = 1
      AND title = 'Understanding Born Again'
      AND description ILIKE '%Nicodemus%'
  ) THEN
    INSERT INTO assignments (
      week_number, title, description, assignment_type, order_index
    )
    SELECT
      1,
      'Understanding Born Again',
      q5_text,
      'reading',
      COALESCE(MAX(order_index), 0) + 1
    FROM assignments
    WHERE week_number = 1
      AND title = 'Understanding Born Again';
  END IF;
END $$;

UPDATE assignments
SET
  commentary = $paul$Adam ate of the fruit and died in that he was separated from open communion and fellowship with God. That death was rectified in the "2nd Adam," who is Christ Jesus. Jesus, when He said, "It is finished," accomplished the work of destroying the enmity between God and man. When we are born again, we are crucified with Christ, yet we are risen into a newness of life as we have become a new creation according to Galatians 6:15 and 2 Corinthians 5:17.$paul$,
  prayer = $paul$Heavenly Father, I know that the wind blows and we can't see it; however, we see its effects. Open my eyes to see Your working and to recognize Your life in my life. May Your love and life light the candle of my heart so that I am recreated in Christ and able to hear Your voice and obey. Show me what to do and how to live. Deliver me from evil and set my feet on a solid path consistent with Your Word and Your purposes for my life. It's in Jesus' name I pray, Amen.$paul$
WHERE id = '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f'
   OR (week_number = 1 AND title = 'Understanding Born Again' AND description ILIKE '%Nicodemus%');

UPDATE assignments
SET
  commentary = $paul$The word "spirit" in the Old Testament is Ruwah or ruwach, and in the New Testament it is pneuma. We know that wind is air or breath. All life exists because it breathes and has breath. The Psalms teach us to "let everything that has breath praise the Lord." We can't see the wind, but we experience its effects. May we recognize the breath of God, the finger of God, and the Spirit of God by faith, not by sight.$paul$,
  prayer = $paul$Heavenly Father, I thank You that You loved me so much that You sent Your only Son, not to condemn me, but to allow me to be in right relationship with You through the blood of Jesus. Jesus, I repent of all of my sins and ask You to forgive me for not following You. I believe in my heart that You are the Christ, the Son of God, and that You died for the sins of the world and that You rose again. I ask You to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation, and help me to follow You and testify of Your good working in my life. In Jesus' mighty name, I pray. Amen.$paul$,
  prayer_note = $paul$This is the Salvation prayer.$paul$
WHERE id = 'd2a6bbce-9068-4871-9ca2-7999cf4d54c5'
   OR (week_number = 1 AND title = 'Understanding Born Again' AND description ILIKE '%John 3:8%');

UPDATE assignments
SET
  commentary = $paul$John 1:4 teaches us that "in Him was life, and that life was the light of man." His light overcomes darkness, including the darkness in our heart without His breath or life. When we believe in Him and confess that with our mouth, we are living in the purposed design. He is lifted up when we live in obedience to His calling and we believe. Believe means to "trust in, cling to, and rely on." May we believe and pray like the father with the son possessed by a demon, "Help thou my unbelief."$paul$,
  prayer = $paul$Heavenly Father, I ask that the life of Your Holy Spirit breathe in me in such a way as to cause me to reflect the light of Your glory in my life. I know that in myself I am not worthy of Your presence and might, but through Christ in me I have the hope of glory. Help me to be the salt and light You've called me to become so that Your life is lifted up in mine. Come, Holy Spirit, and have Your way in me today!$paul$
WHERE id = '92d35e76-8587-4e43-9db5-ad2a4d4b9c5a'
   OR (week_number = 1 AND title = 'Understanding Born Again' AND description ILIKE '%lifted up%');

UPDATE assignments
SET
  commentary = $paul$Our trusting and believing is a manifestation of His grace and His moving in our hearts. We can't see God, but Jesus tells Thomas to experience with his senses the reality of Jesus' nail holes and the spear in His side. He then tells Thomas that he's blessed having been able to see and believe, but that "blessed are they who do not see, yet believe." We may not be able to see with our eyes and experience with our senses the reality of Christ and His working in us, but believing will be seeing if we trust God and lean not on our own understanding (Proverbs 3:5-6).$paul$,
  prayer = $paul$Father God, I bless Your holy name that is above all other names. I believe You sent Your only Son, Jesus, to be the sacrificial Lamb of God for my forgiveness. I confess my sins openly before You and ask You to forgive me of my sins and cleanse me from all unrighteousness. I thank You that You loved me so much that Jesus came to give me life and that I am not condemned. Come, Holy Spirit, and fill me to be useful in Your kingdom today.$paul$
WHERE id = 'cacc072a-ee39-4ea8-bf16-ebbf4450a195'
   OR (week_number = 1 AND title = 'Understanding Born Again' AND description ILIKE '%John 3:16%');

UPDATE assignments
SET
  commentary = $paul$It is with our heart that we believe and with our mouth that we confess. The Bible teaches us to keep our heart, and it teaches us about the importance of our words. It is important that we intentionally feed our heart the truth of the gospel (good news) because "out of the abundance of the heart the mouth speaks" (Matt. 12:34 and Luke 6:45).

Romans 10:9-10 is a fundamental scripture that reveals what the Gospel is and how we are to respond. We are to believe with our heart. Proverbs 4:23 teaches us to "keep your heart with all diligence, for out of it are the issues of life." We believe with our heart and we confess with our mouth. The words of our mouth are a common theme in God's Word. The power of life and death is in the tongue. James tells us that it is like a rudder that steers our ship or a bit in the horse's mouth that controls his direction. May we believe in our hearts the truth of God's Word and confess with our mouth the great and glorious news of the Gospel: that Jesus died and was raised for our justification so that we might become the children of God.$paul$,
  prayer = $paul$Heavenly Father, I believe with all of my heart that You are God and that Jesus Christ is the fulfillment of Your purpose on earth, and that He came, lived, and died for the sins of the whole world. I believe that He was raised from the dead and that the same Holy Spirit who worked in Him to raise Him dwells in me. I believe with my heart and, as a result of this belief, I confess with my mouth that Jesus Christ is Lord of all, and He is Lord of my life. Help me to keep my heart unspotted from the world and to live in ways that honor You, Lord.$paul$
WHERE id = 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04'
   OR (
     week_number = 1
     AND title = 'Understanding Born Again'
     AND description = $paul$Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?$paul$
   );

UPDATE assignments
SET
  commentary = $paul$Revelation 12:11 tells how believers overcome "by the blood of the Lamb and by the word of their testimony." Write down your testimony of being "born again" and asking Jesus to make you a new creation. You are re-created in Christ Jesus, and that is a story worthy of sharing. Be encouraged to share the testimony of your salvation and your walk with Christ. Jay Haizlip once said, "A man with an experience can't be persuaded by a man with an opinion." Your story matters. When times get hard, remember His love and His working in your life.$paul$
WHERE id = 'b3073316-a82e-45ff-99e1-ab3a334799e4'
   OR (week_number = 1 AND title = 'Your Salvation Story');

UPDATE assignments
SET
  commentary = $paul$Water baptism is an outward representation of what we believe has happened on the inside when we asked Jesus to come into our life and become Lord. We are buried with Him in baptism, represented by going under the water, and we are raised to newness of life as we rise out of the water in celebration of new life in Christ. Baptism was an act continued by the early church even to represent repentance. John the Baptist baptized Jesus, and after the church was formed, the apostles regularly baptized new converts to the faith. The book of Acts records baptism throughout; however, baptism is not a work that saves, nor is a failure to do so an impediment to one's salvation. Consider the thief on the cross to whom Jesus said, "Today you will be with Me in paradise." Our salvation is a result of the Holy Spirit's prompting our heart to believe and our confession of Jesus as Lord. Consider Acts 2:38, Romans 6:4, and Colossians 2:12.$paul$,
  prayer = $paul$Heavenly Father, I pray that You would continuously remind me to be crucified with Christ and risen with Him in this new life You have granted. Just as there is no breathing or life under the water, I pray that I would be immediately rescued from drowning in the sorrows of daily life as I'm energized and given life by Your Spirit to live for You. Come, Holy Spirit, and raise me today into the newness of life that only Your resurrection life can provide.$paul$
WHERE id = 'dd10ef64-f38d-4f84-b93a-31f601e9f812'
   OR (week_number = 1 AND title = 'The Meaning of Baptism');

UPDATE assignments
SET
  description = $paul$Read slowly and pray this out loud or in your heart.$paul$,
  guided_prayer = $paul$Heavenly Father, I thank You that You loved me so much that You sent Your only Son, not to condemn me, but to allow me to be in right relationship with You through the blood of Jesus. Jesus, I repent of all of my sins and ask You to forgive me for not following You. I believe in my heart that You are the Christ, the Son of God, and that You died for the sins of the world and that You rose again. I ask You to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation, and help me to follow You and testify of Your good working in my life. In Jesus' mighty name, I pray. Amen.$paul$,
  prayer = NULL
WHERE id = '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad'
   OR (week_number = 1 AND title = 'Prayer: Talking with Your Father');

UPDATE assignments
SET
  commentary = $paul$The Lord's Prayer in Matthew 6 is a wonderful model of prayer. It begins with "Our Father in heaven, hallowed be Your name." This expresses reverence and "fear of God" as well as worship. We pray that His kingdom come and His will be done on earth as it is in heaven. We are praying that heavenly influence be welcomed into our lives. Prayer for provision is next, followed by forgiveness and the intent to forgive. We then pray for our leading to be by God, not into temptation, but for deliverance from evil. Mark Rutland wrote a book about the Lord's Prayer and Psalm 23. In it, he talks about how the Lord's Prayer takes about 21 seconds to pray, and it can be a healthy prayer. Prayer is simply our talking and communing with God. Don't overthink it. Submit your words and heart to the Lord and ask for what you think you need, and allow Him to grow your prayer life as you grow in the knowledge of His Word and will for your life. Perhaps the most important aspect of prayer is the understanding and belief that God desires that we pray and that He hears us. Hebrews 11:6 expresses that walking with God requires that we believe that He is God and that He rewards us when we diligently seek Him. Prayer is a primary way we "diligently seek Him."$paul$,
  guided_prayer = $paul$Heavenly Father, I ask You to help guide me to pray without ceasing and to continuously pray with thanksgiving and praise to the One who is able to do exceedingly and abundantly above all I could ask or think. May Your kingdom purposes come and be carried out in my life as I live in obedience to Your Word and Your Holy Spirit's promptings. Lead me not into temptations that distract me from Your design, and deliver me from evil. Forgive me of my trespasses and missteps as I forgive those who do wrong to me. Just as I have been forgiven, I will walk in forgiveness toward others.$paul$,
  prayer = NULL
WHERE id = '2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e'
   OR (week_number = 2 AND title ILIKE 'Learning to Pray');

UPDATE assignments
SET
  commentary = $paul$Prayer most commonly takes the form of petitions we address to God. Some people really discuss prayer as a transformative communication with God, where we ask of Him, but He answers us in this transformative process of relationship. Garth Brooks wrote a song about thanking God for "Unanswered Prayers." May we be biblically informed in our approach to prayer. The Word of God is clear that God knows what we have need of before we ask, but He still desires that we ask, and that we do not ask amiss. Prayer is our authoritative approach as ambassadors of a heavenly kingdom to request from God His divine influence in our earthly pursuits, challenges, processes, and victories. James 4:2-3 tells us that we do not have because we do not ask, and even when we ask, we ask with wrong motives. May we appreciate the gift of relationship we have with God, which allows us to come boldly (Hebrews 4:16) into the throne of grace and ask, seek, and knock (Matthew 7:7-8). Prayer is simply our coming humbly before our Creator, who is God, and asking Him for what we think we need for His kingdom to come and His will to be done on earth and in our lives as He wills according to His heavenly and eternal purposes.$paul$,
  prayer = $paul$Heavenly Father, I am so eternally grateful for Your Son, Jesus, and His finished work on Calvary that allows me, through His blood, to come into Your presence boldly and talk with You concerning my life. Come, Holy Spirit, and reveal to me the Father's plan and purposes for my life, and help me to align my will and purposes with Yours so that my prayers avail much. Keep me humble before You and courageously confident in who You are in me. Give me this day all I need to live well and obey Your voice. Bless me in my life so that I may be a blessing in the lives of others. In Jesus' mighty name I pray, Amen.$paul$,
  guided_prayer = NULL
WHERE id = '63bef6fa-c0c2-492b-9fa2-65a9a4f23645'
   OR (week_number = 2 AND title ILIKE 'Understanding Prayer');

UPDATE assignments
SET
  commentary = $paul$The four Gospels of Matthew, Mark, Luke, and John all give a unique perspective and insight into the life of Jesus and His working in His creation. Beginning in John is a great start. Genesis and John really give a great picture of the problem (Adam in the Garden) and the solution (Jesus Christ). Getting to know God is best done by RPM (Read, Pray, Meditate). We are told in Romans 12:1-3 that we should present our bodies a living sacrifice, which is our "reasonable service" (the rational choice of our minds). We are to stop conforming to the world around us and be transformed by the renewing of our mind. We renew our mind by God's Word, which is life and health to all of our flesh. John 6:63 tells us that the flesh profits nothing, but the words Jesus speaks are SPIRIT and they are LIFE. Jesus is the Word made flesh, and the opening of the book of John reminds us of the importance of God's Word in our life and how His life in us is the light that overcomes darkness. Consider Joshua 1:8, Proverbs 4:20-23, and Psalm 119:11. Studying the Bible (God's Word) is a critical habit to develop in our Christian walk so that we are able to stand on truth and be transformed by renewing our minds to think right.$paul$,
  prayer = $paul$Heavenly Father, I am thankful for Your Word and the Holy Bible that has been given to me in order to renew my mind and direct my heart. Help me to listen to Your voice through the inspired Word of God and obey. Jesus, You said that our lives should be built on the rock of hearing and obeying Your words. Lead me by Your Spirit into truth so that my mind is renewed to think right, my choices are impacted so that I live right, and my heart is filled and kept so that I talk right. Come, Holy Spirit, and let Your Word speak to me and equip me with the knowledge of God. It's in the mighty name of Jesus I pray, Amen.$paul$
WHERE week_number = 2 AND title ILIKE 'Beginning Bible Study';

UPDATE assignments
SET
  commentary = $paul$One common theme in the Bible is the idea of warfare (spiritual) and the need for spiritual armor. This armor of God is very unique in that each part represents an equipping that we are unable to access on our own. We do not make the armor; we are encouraged to "put on" the whole armor of God. We are called to be soldiers, but the Bible is clear that a soldier is worthy of his hire and he doesn't equip himself. He is equipped by the kingdom he represents. 1 Corinthians 9:7 tells us that we do not go to war at our own expense, and 2 Timothy 2:3 reminds us that we must endure hardships as soldiers of Jesus Christ. Each part of the armor is representative of Christ's equipping us for battle that is not against a normal fleshly army, but is spiritual. Every piece of our armor is designed by and forged by our Savior and is able to protect us from the enemy. It all represents key aspects of our walk with Christ. Truth (belt)... Shoes (gospel of peace)... Breastplate (righteousness)... Shield (faith)... Sword (Word of God). Take time to consider each piece and how its significance is worthy of your "putting on the whole armor of God."$paul$,
  prayer = $paul$Dearest Heavenly Father, Your name is above all other names, and I seek to become an effective soldier in Your army. Help me to be equipped properly with the belt of truth, my feet protected and energized by the gospel of peace, my vital organs protected by the breastplate of righteousness. Help me to put on the helmet of salvation and to take up the shield of faith. Help me to wield the sword of the Word of God rightly and use it offensively against the devil, but never to cut up and destroy Your own people. Help me to stand against all the schemes of the warring principalities, powers, and unseen spiritual forces that are against Your purposes and Your best for my life. I am a soldier of the King of Kings, and I will receive Your orders, clothed for battle, and stand in victory. Help me, Lord, to stand strong and obedient. Amen.$paul$
WHERE week_number = 3 AND title ILIKE 'The Armor of God';

UPDATE assignments
SET
  commentary = $paul$When we are "born again" by the Spirit of the living God, we are re-created in Christ Jesus and the old has passed away, crucified with Christ (as represented in baptism), but we still have challenges and struggles of the "old man" that try to distract us from this new life. Paul talks about this in Romans 7 as he tells us that "what I want to do I don't, and what I don't want to do, I do... who will save me from this body of sin?" We all find ourselves fighting a battle to be "crucified with Christ, nevertheless I live," according to Galatians 2:20. Romans 6:12-13 tells us not to let sin reign in our mortal body and to present ourselves to God as instruments of righteousness. Acts 3:19 tells us to repent and be baptized. Repentance requires a turning around and going in another direction. Ephesians 4:22-24 tells us to put off the old man and be renewed in our minds and put on the new man. Be intentional about renewing your mind by God's Word so that it is easier to identify old habits inconsistent with your new way of life. Repentance requires that you take responsibility for your inconsistency. Romans 12:2 tells us to stop conforming to the culture around us and be transformed by the renewing of our minds so that our outward expression of life is consistent with our inward renewal through rebirth. Live out what He has gifted you within.$paul$,
  prayer = $paul$Heavenly Father, I am turning from the life I once lived to follow Jesus Christ. I surrender my own way to walk in His truth by the power of the Holy Spirit. I pray that Your Word would come alive in my heart and mind to reveal the errors in my walk and to help me break bad habits and create new habits of obedience that lead to life. Come, Holy Spirit, and fill me, lead me, and show me how to walk by Your prompting and guidance. Counsel me and show me how to live and walk in this new direction.$paul$
WHERE week_number = 3 AND title ILIKE 'Turning from the Old Direction';

UPDATE assignments
SET
  commentary = $paul$Hebrews 10:24-25 gives us a reminder that we are better together because we can encourage one another and spur one another on. We have to take responsibility for areas of our lives we know need correction, but we are not to be left alone in the sanctification process. Paul, in Phil. 2:12-13, tells us to obey and to work out our salvation with fear and trembling as God is working in us for His purposes. Find people you can connect with and hold one another accountable. Choose to talk about things that matter and discuss your commitment to growth and obedience.$paul$,
  prayer = $paul$Heavenly Father, I am intentionally seeking out godly relationships to help me be encouraged in my faith and to give me outlets to share my faith. Send laborers across my path to grow me and share with me what I need, and help me to be a fellow laborer who shares the gospel with others. Help me find a healthy community of believers to do life with and grow in a community of faith. I know You desire that I be blessed to be a blessing and that the body of Christ grow to maturity in unity of the faith. I love You, Lord, and I believe You reward my diligent seeking of You. In Jesus' name I pray, Amen.$paul$
WHERE week_number = 3 AND title ILIKE 'Making a Stand Plan';

UPDATE assignments
SET
  commentary = $paul$Don't forget that the only way you grow in relationship with others is to spend time with them. Your relationship with God is strengthened when you talk with Him (prayer) and when you learn more about Him (the Holy Bible). If you want to improve a relationship with someone, you must invest in that relationship. You must be interested in what they like and need, and you must invest time intentionally. Our Heavenly Father has done the heavy lifting by "first loving us" (1 John 4:7-10) and by dying for our sins so that we can be in relationship with Him. May we be strengthened by our growth and fellowship because we intentionally seek first His kingdom (Matthew 6:33) and spend time with His Word and with Him in prayer.$paul$,
  guided_prayer = $paul$My Father in Heaven, I ask You to give me strength as I seek to become all You've created me to become. I ask for Your strength against temptations and lusts that would draw me away from a right relationship with You and with others in my life. Help me to seek first Your kingdom and to make choices consistent with Your design and plans for my life. Help me to draw near to God and resist the devil so that he must flee. Come, have Your way in my life and use me how You want to. Help me be different so I can make a difference. In Jesus' name I pray, Amen.$paul$
WHERE week_number = 3 AND title ILIKE 'Prayer for Strength';

SELECT
  a.week_number,
  a.order_index,
  a.title,
  left(a.description, 72) AS description_prefix,
  left(coalesce(a.commentary, ''), 48) AS commentary_prefix,
  left(coalesce(a.prayer, a.guided_prayer, ''), 48) AS prayer_prefix,
  a.prayer_note
FROM assignments a
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
ORDER BY a.week_number, a.order_index;

COMMIT;
