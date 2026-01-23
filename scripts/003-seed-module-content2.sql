-- First, clear existing content to avoid duplicates
DELETE FROM assignments;
DELETE FROM weekly_content;

-- Seed weekly content for the 6-week discipleship program

-- Week 1: The New Birth
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(1, 'The New Birth', 'Understanding what it means to be born again and the significance of baptism. This foundational week establishes your new identity in Christ and the transformative power of salvation.', 'John 3:3-7 - "Jesus answered him, Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God."');

-- Week 2: The New Life
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(2, 'The New Life', 'Developing essential spiritual disciplines of prayer and Bible study. Learn to communicate with God and feed your spirit through His Word.', '2 Corinthians 5:17 - "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come."');

-- Week 3: The New Stand
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(3, 'The New Stand', 'Taking a stand against evil and turning away from your old direction. Learn to resist temptation and walk in righteousness.', 'Ephesians 6:13 - "Therefore take up the whole armor of God, that you may be able to withstand in the evil day, and having done all, to stand firm."');

-- Week 4: The New Walk
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(4, 'The New Walk', 'Walking in consistency with likeminded believers. Building fellowship and accountability with other Christians as you grow in faith.', 'Colossians 2:6-7 - "Therefore, as you received Christ Jesus the Lord, so walk in him, rooted and built up in him and established in the faith."');

-- Week 5: The New Win
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(5, 'The New Win', 'Winning over the world - understanding and overcoming temptation through the inward battle of spirit versus flesh.', '1 John 5:4 - "For everyone who has been born of God overcomes the world. And this is the victory that has overcome the world—our faith."');

-- Week 6: The New Work
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(6, 'The New Work', 'Sharing the hope within you. Creating a list of friends who need the Lord, praying for them, and preparing to share your testimony.', '1 Peter 3:15 - "But in your hearts honor Christ the Lord as holy, always being prepared to make a defense to anyone who asks you for a reason for the hope that is in you; yet do it with gentleness and respect."');

-- Seed assignments for each week

-- Week 1 Assignments: The New Birth
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(1, 'Understanding Born Again', 'Study John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again" and how this applies to your life.', 'reading', 1),
(1, 'Your Salvation Story', 'Reflect on and write about when and how you accepted Christ. If you have not yet made this decision, discuss with your leader what it means to accept Jesus as Lord.', 'reflection', 2),
(1, 'The Meaning of Baptism', 'Study Matthew 28:19-20 and Romans 6:3-4. Write about what baptism symbolizes and its importance in the believer''s life. Discuss with your leader if you have been baptized or need to take this step.', 'reading', 3),
(1, 'Prayer: Talking with Your Father', 'Begin a daily practice of spending 10 minutes talking to God. Share your thoughts, fears, hopes, and gratitude. Record your experience each day this week.', 'prayer', 4);

-- Week 2 Assignments: The New Life
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(2, 'Learning to Pray', 'Study Matthew 6:5-15 (The Lord''s Prayer). Practice praying this prayer each morning, then add your own personal prayers. What does each part of this prayer teach you about communicating with God?', 'reading', 1),
(2, 'Understanding Prayer', 'Write about what prayer is and is not. How is prayer different from talking to friends? What makes prayer powerful? Discuss your thoughts with your leader.', 'reflection', 2),
(2, 'Beginning Bible Study', 'Start reading the Gospel of John, one chapter per day. For each chapter, write down: one thing you learned about Jesus, one question you have, and one way to apply it.', 'reading', 3),
(2, 'Building Bible Habits', 'Choose a consistent time and place for daily Bible reading. Track your consistency this week. Share any obstacles with your leader.', 'action', 4);

-- Week 3 Assignments: The New Stand
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(3, 'The Armor of God', 'Read Ephesians 6:10-18. List each piece of the armor and write what each one represents. Which pieces do you need to strengthen?', 'reading', 1),
(3, 'Turning from the Old Direction', 'Honestly identify 2-3 areas in your life where you need to take a stand against evil or turn away from old patterns. These might be habits, relationships, attitudes, or thoughts.', 'reflection', 2),
(3, 'Making a Stand Plan', 'For each area you identified, write a specific action plan for how you will stand firm. Include accountability measures and what you will do when tempted.', 'action', 3),
(3, 'Prayer for Strength', 'Spend daily time praying for God''s strength to stand firm. Pray through each piece of the armor of God, asking God to equip you for spiritual battle.', 'prayer', 4);

-- Week 4 Assignments: The New Walk
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(4, 'Walking with Others', 'Read Hebrews 10:23-25 and Proverbs 27:17. Why is fellowship with other believers important? What happens when we try to walk alone?', 'reading', 1),
(4, 'Consistency in Faith', 'Evaluate your consistency in the spiritual habits you''ve been building: prayer, Bible reading, fellowship. Rate yourself and identify areas for improvement.', 'reflection', 2),
(4, 'Connect with Believers', 'If you haven''t already, commit to attending a local church service or small group this week. After attending, discuss your experience with your leader.', 'action', 3),
(4, 'Finding Likeminded Believers', 'Identify 2-3 believers who can walk alongside you in your faith journey beyond this discipleship experience. Reach out to strengthen those relationships.', 'action', 4);

-- Week 5 Assignments: The New Win
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(5, 'Understanding Temptation', 'Read 1 Corinthians 10:13 and James 1:13-15. What do these passages teach about where temptation comes from and God''s promise to help us?', 'reading', 1),
(5, 'The Inward Battle', 'Study Romans 7:14-25 and Galatians 5:16-26. Write about the struggle between the flesh and the spirit. Which works of the flesh do you struggle with most?', 'reading', 2),
(5, 'Victory Journal', 'Keep a daily journal this week recording: temptations faced, how you responded, and the outcome. Note your victories and the areas where you need more growth.', 'reflection', 3),
(5, 'Winning Through Accountability', 'Practice being vulnerable with your leader about your struggles. Share your victory journal and receive encouragement and prayer. Accountability brings freedom!', 'action', 4);

-- Week 6 Assignments: The New Work
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(6, 'Always Be Prepared', 'Study 1 Peter 3:15-16 deeply. What does it mean to always be prepared to give a reason for your hope? How should you share - with what attitude?', 'reading', 1),
(6, 'Create Your Friend List', 'Make a list of 5 friends, family members, coworkers, or neighbors who need to know the Lord. Be specific - write their names and your relationship with them.', 'action', 2),
(6, 'Pray for Your Friends', 'Commit to praying daily for each person on your list. Ask God to open their hearts, provide opportunities for you to share, and give you the right words. Start this habit now and continue beyond this program.', 'prayer', 3),
(6, 'Share Your Testimony', 'Write out your personal testimony in 3 parts: life before Christ, how you came to know Him, and life after. Practice sharing it in 3-5 minutes with your leader.', 'action', 4),
(6, 'The Hope Within You', 'Based on 1 Peter 3:15, practice explaining the Gospel clearly: who Jesus is, what He did, and how someone can receive Him. Be ready to share this with anyone who asks about your hope!', 'reflection', 5);
