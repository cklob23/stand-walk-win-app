-- Seed weekly content for the 6-week discipleship program

-- Week 1: The New Birth
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(1, 'The New Birth', 'What it means to be born again, the meaning of baptism, and beginning your journey with Christ through reflection and prayer.', 'John 3:3-7');

-- Week 2: The New Life
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(2, 'The New Life', 'Understanding prayer - what it is and how to practice it. Learning to read the Bible and apply its teachings to your daily life.', '2 Corinthians 5:17');

-- Week 3: The New Stand
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(3, 'The New Stand', 'Standing firm against evil, turning away from old patterns, and identifying areas of struggle in your spiritual walk.', 'Ephesians 6:10-18');

-- Week 4: The New Walk
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(4, 'The New Walk', 'Walking consistently in faith, building fellowship with like-minded believers, and developing lasting spiritual habits.', 'Colossians 2:6-7');

-- Week 5: The New Win
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(5, 'The New Win', 'Overcoming temptation, understanding the inward battle, and practicing daily spiritual discipline for victory.', '1 John 5:4-5');

-- Week 6: The New Work
INSERT INTO weekly_content (week_number, title, description, scripture_reference) VALUES
(6, 'The New Work', 'Making a list of friends who need the Lord, praying for them consistently, and sharing the hope within you.', '1 Peter 3:15');

-- Seed assignments for each week

-- Week 1 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(1, 'Read John 3:1-21', 'Read the story of Nicodemus and Jesus''s teaching on being born again. Take notes on what stands out to you.', 'reading', 1),
(1, 'Reflect on Your Conversion', 'Write about when and how you came to know Christ. What changed in your life?', 'reflection', 2),
(1, 'Learn About Baptism', 'Study Matthew 28:19 and Romans 6:3-4. Discuss the meaning and significance of baptism with your leader.', 'reading', 3),
(1, 'Daily Prayer Practice', 'Spend 10 minutes each day in prayer, simply talking to God about your new journey.', 'prayer', 4);

-- Week 2 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(2, 'Read Matthew 6:5-15', 'Study Jesus''s teaching on prayer, including the Lord''s Prayer. Practice praying this prayer daily.', 'reading', 1),
(2, 'Start a Bible Reading Plan', 'Begin reading one chapter of the Gospel of John each day. Journal your thoughts.', 'reading', 2),
(2, 'Prayer Journal Entry', 'Keep a prayer journal this week. Write down your prayers and any answers you notice.', 'reflection', 3),
(2, 'Apply Scripture to Life', 'Choose one verse from your reading and write how you can apply it to a current situation.', 'action', 4);

-- Week 3 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(3, 'Read Ephesians 6:10-18', 'Study the armor of God. Identify each piece and its spiritual significance.', 'reading', 1),
(3, 'Identify Areas of Struggle', 'Honestly reflect on areas where you struggle spiritually. Share these with your leader in confidence.', 'reflection', 2),
(3, 'Breaking Old Patterns', 'Identify one old habit or pattern you need to turn away from. Create a plan to address it.', 'action', 3),
(3, 'Pray for Strength', 'Spend time each day praying for strength to stand firm against temptation and spiritual attacks.', 'prayer', 4);

-- Week 4 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(4, 'Read Hebrews 10:23-25', 'Learn about the importance of fellowship and encouraging one another in faith.', 'reading', 1),
(4, 'Build a Spiritual Habit', 'Establish one new spiritual discipline (morning devotion, evening prayer, etc.) and practice it daily.', 'action', 2),
(4, 'Connect with Believers', 'Attend a church service or small group. Reflect on the experience with your leader.', 'action', 3),
(4, 'Consistency Check', 'Evaluate your consistency in prayer, Bible reading, and fellowship. Set goals for improvement.', 'reflection', 4);

-- Week 5 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(5, 'Read 1 Corinthians 10:13', 'Study God''s promise about temptation and the way of escape He provides.', 'reading', 1),
(5, 'Understand the Inward Battle', 'Read Romans 7:14-25 and Galatians 5:16-26. Reflect on the struggle between flesh and spirit.', 'reading', 2),
(5, 'Victory Journal', 'Keep a daily log of temptations faced and how you responded. Note victories and areas for growth.', 'reflection', 3),
(5, 'Accountability Practice', 'Share your struggles and victories openly with your leader. Practice vulnerability and receive encouragement.', 'action', 4);

-- Week 6 Assignments
INSERT INTO assignments (week_number, title, description, assignment_type, order_index) VALUES
(6, 'Read 1 Peter 3:15-16', 'Learn how to always be prepared to share the reason for your hope with gentleness and respect.', 'reading', 1),
(6, 'Create Your Friend List', 'Make a list of 5 friends or family members who need to know the Lord.', 'action', 2),
(6, 'Pray for Your List', 'Commit to praying daily for each person on your list throughout this week and beyond.', 'prayer', 3),
(6, 'Share Your Story', 'Practice sharing your testimony with your leader. Prepare to share it with others.', 'action', 4),
(6, 'Complete the Journey', 'Reflect on all 6 weeks. Write about how you''ve grown and your commitments going forward.', 'reflection', 5);
