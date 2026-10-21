'use client'

import { AssignmentCard } from '@/components/dashboard/assignment-card'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Assignment } from '@/lib/types'
import { groupAssignments } from '@/lib/assignment-grouping'

const createdAt = '2026-01-01T00:00:00.000Z'

const week1Rows: Assignment[] = [
  {
    id: '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f',
    week_number: 1,
    title: 'Understanding Born Again',
    description: 'Read John 3:1-21 - the story of Nicodemus. Write in your own words what it means to be "born again."',
    assignment_type: 'reading',
    order_index: 1,
    created_at: createdAt,
    commentary: 'Adam ate of the fruit and died in that he was separated from open communion and fellowship with God. That death was rectified in the "2nd Adam" who is Christ Jesus. Jesus, when He said, "It is finished" accomplished the work of destroying the enmity between God and man. When we are born again, we are crucified with Christ, yet we are risen into a newness of life as we have become a new creation according to Galatians 6:15 and 2 Corinthians 5:17.',
    prayer: 'Heavenly Father, I thank you that You loved me so much that you sent your only Son, not to condemn me, but to allow me to be in right relationship with you through the blood of Jesus. Jesus, I repent of all of my sins and ask you to forgive me for not following you. I believe in my heart that You are the Christ, the Son of God and that You died for the sins of the world and that You rose again. I ask you to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation and help me to follow you and testify of your good working in my life. In Jesus\' mighty name, I pray. Amen',
  },
  {
    id: 'd2a6bbce-9068-4871-9ca2-7999cf4d54c5',
    week_number: 1,
    title: 'Understanding Born Again',
    description: 'In John 3:8, what does the wind represent, and what is its effect?',
    assignment_type: 'reading',
    order_index: 2,
    created_at: createdAt,
    commentary: 'The word "spirit" in the Old Testament is Ruwah or ruwach and in the New Testament, it is pneuma. We know that wind is air or breath. All life exists because it breathes and has breath. Psalms teaches us to "let everything that has breath praise the Lord." We can\'t see the wind, but we experience its effects. May we recognize the breath of God, the finger of God, and the Spirit of God by faith, not by sight.',
    prayer: 'Heavenly Father, I know that the wind blows and we can\'t see it; however, we see its effects. Open my eyes to see your working and to recognize your life in my life. May your love and life light the candle of my heart so that I am recreated in Christ and able to hear your voice and obey. Show me what to do and how to live. Deliver me from evil and set my feet on a solid path consistent with Your Word and your purposes for my life. It\'s in Jesus\' name I pray, Amen.',
  },
  {
    id: '92d35e76-8587-4e43-9db5-ad2a4d4b9c5a',
    week_number: 1,
    title: 'Understanding Born Again',
    description: 'In John 3:14, what does Jesus mean by "being lifted up"? In John 3:15, what does it mean to believe?',
    assignment_type: 'reading',
    order_index: 3,
    created_at: createdAt,
    commentary: 'John 1:4 teaches us that "in Him was life and that life was the light of man." His light overcomes darkness, including the darkness in our heart without His breath or life. When we believe in Him and confess that with our mouth, we are living in the purposed design. He is lifted up when we live in obedience to His calling and we believe. Believe means to "trust in, cling to, and rely on." May we believe and pray like the father with the son possessed with a demon, "help thou my unbelief."',
    prayer: 'Heavenly Father, I ask that the life of your Holy Spirit breathe in me in such a way as to cause me to reflect the light of your glory in my life. I know that in myself I am not worthy of your presence and might, but through Christ in me I have the hope of glory. Help me to be the salt and light you\'ve called me to become so that your life is lifted up in mine. Come Holy Spirit and have your way in me today!',
  },
  {
    id: 'cacc072a-ee39-4ea8-bf16-ebbf4450a195',
    week_number: 1,
    title: 'Understanding Born Again',
    description: 'How does John 3:16 connect with your own story of trusting Jesus as Lord and Savior?',
    assignment_type: 'reading',
    order_index: 4,
    created_at: createdAt,
    commentary: 'Our trusting and believing is a manifestation of His grace and His moving in our hearts. We can\'t see God, but Jesus tells Thomas to experience with his senses the reality of Jesus\' nail holes and the spear in His side. He then tells Thomas that he\'s blessed having been able to see and believe, but that "blessed are they who do not see, yet believe." We may not be able to see with our eyes and experience with our senses the reality of Christ and His working in us, but believing will be seeing if we trust God and lean not on our own understanding (Proverbs 3:5-6).',
    prayer: 'Father God, I bless your holy name that is above all other names. I believe you sent your only Son, Jesus, to be the sacrificial lamb of God for my forgiveness. I confess my sins openly before you and ask you to forgive me of my sins and cleanse me from all unrighteousness. I thank you that you loved me so much that Jesus came to give me life and that I am not condemned. Come Holy Spirit and fill me to be useful in your kingdom today.',
  },
  {
    id: 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04',
    week_number: 1,
    title: 'Understanding Born Again',
    description: 'Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?',
    assignment_type: 'reading',
    order_index: 5,
    created_at: createdAt,
    commentary: 'It\'s with our heart that we believe and with the mouth we confess. The Bible teaches us to keep our heart and it teaches us about the importance of our words. It\'s important that we intentionally feed our heart the truth of the gospel (good news) because "out of the abundance of the heart, the mouth speaks". (Matt. 12:34 and Luke 6:45).\n\nRomans 10:9-10 is a fundamental scripture that reveals what the Gospel is and how we are to respond. We are to believe with our heart. Proverbs 4:23 teaches us to "keep your heart with all diligence for out of it are the issues of life." We believe with our heart and we confess with our mouth. The words of our mouth are a common theme in God\'s word. The power of life and death are in the tongue. James tells us that it\'s like a rudder that steers our ship or a bit in the horse\'s mouth that controls his direction. May we believe in our hearts the truth of God\'s word and confess with our mouth the great and glorious news of the Gospel that Jesus died and was raised for our justification so that we might become the children of God.',
    prayer: 'Heavenly Father, I believe with all of my heart that you are God and that Jesus Christ is the fulfillment of your purpose in earth and that He came, lived, and died for the sins of the whole world. I believe that He was raised from the dead and that the same Holy Spirit working in Him to raise Him dwells in me. I believe with my heart and, as a result of this belief, I confess with my mouth that Jesus Christ is Lord of all and He is Lord of my life. Help me to keep my heart unspotted from the world and to live in ways that honor You, Lord.',
  },
]

const week1Prayer: Assignment = {
  id: '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad',
  week_number: 1,
  title: 'Prayer: Talking with Your Father',
  description: 'Begin a daily practice of spending 10 minutes talking to God. Share your thoughts, fears, and thanks.',
  assignment_type: 'prayer',
  order_index: 8,
  created_at: createdAt,
  commentary: null,
  prayer: 'Heavenly Father, I thank you that You loved me so much that you sent your only Son, not to condemn me, but to allow me to be in right relationship with you through the blood of Jesus. Jesus, I repent of all of my sins and ask you to forgive me for not following you. I believe in my heart that You are the Christ, the Son of God and that You died for the sins of the world and that You rose again. I ask you to save me and fill me with Your Holy Spirit. Come into my life, make me a new creation and help me to follow you and testify of your good working in my life. In Jesus\' mighty name, I pray. Amen',
}

const week2LearningToPray: Assignment = {
  id: '2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e',
  week_number: 2,
  title: 'Learning to Pray',
  description: 'Study Matthew 6:5-15 (The Lord\'s Prayer). Practice praying this prayer each morning, then write what stood out.',
  assignment_type: 'reading',
  order_index: 1,
  created_at: createdAt,
  commentary: 'The Lord\'s Prayer in Matthew 6 is a wonderful model of prayer. It begins with "Our Father in heaven, hallowed be your name." This expresses reverence and "fear of God" as well as worship. We pray that His Kingdom come and His will be done on earth as it is in heaven. We are praying that heavenly influence be welcomed into our lives. Prayer for provision is next followed by forgiveness and the intent to forgive. We then pray for our leading to be by God, not to temptation, but deliverance from evil. Mark Rutland wrote a book about the Lord\'s prayer and Psalms 23. In it, he talks about how the Lord\'s prayer takes about 21 seconds to pray and it can be a healthy prayer. Prayer is simply our talking and communing with God. Don\'t overthink it. Submit your words and heart to the Lord and ask for what you think you need and allow Him to grow in your prayer life as you grow in the knowledge of His word and will for your life. Perhaps the most important aspect of prayer is the understanding and belief that God desires we pray and He hears us. Hebrews 11:6 expresses that walking with God requires that we believe that He is God and He rewards us when we diligently seek Him. Prayer is a primary way we "diligently seek Him."',
  prayer: 'Heavenly Father, I ask you to help guide me to pray without ceasing and to continuously pray with thanksgiving and praise to the One who is able to do exceedingly and abundantly above all I could ask or think. May your kingdom purposes come and be carried out in my life as I live in obedience to Your word and Your Holy Spirit promptings. Lead me not into temptations that distract me from Your design and deliver me from evil. Forgive me of my trespasses and missteps as I forgive those who do wrong to me. Just as I have been forgiven, I will walk in forgiveness toward others.',
}

const comingSoonPrayer: Assignment = {
  id: 'preview-week3-prayer',
  week_number: 3,
  title: 'Prayer for Strength',
  description: 'Spend 10 minutes asking God for strength this week.',
  assignment_type: 'prayer',
  order_index: 1,
  created_at: createdAt,
  commentary: null,
  prayer: null,
}

const cardProps = {
  pairingId: 'preview-pairing',
  userId: 'preview-learner',
  userRole: 'learner' as const,
  currentWeek: 1,
  totalWeekAssignments: 5,
  completedWeekAssignments: 0,
  defaultOpen: true,
  guidanceDefaultOpen: true,
}

export default function Week12PreviewPage() {
  const [bornAgain] = groupAssignments(week1Rows)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Week 1 and 2 content preview</h1>
            <p className="text-sm text-muted-foreground">
              Mock data from the live Week 1-2 ids plus Paul&apos;s commentary and prayer text.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <section id="question-guidance" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Question with Commentary and Prayer
          </h2>
          <AssignmentCard assignment={bornAgain} {...cardProps} />
        </section>

        <section id="week1-guided-prayer" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Week 1 guided prayer
          </h2>
          <AssignmentCard assignment={week1Prayer} {...cardProps} />
        </section>

        <section id="week2-learning-to-pray" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Week 2 Learning to Pray
          </h2>
          <AssignmentCard assignment={week2LearningToPray} {...cardProps} currentWeek={2} />
        </section>

        <section id="coming-soon-prayer" className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coming soon prayer card
          </h2>
          <AssignmentCard assignment={comingSoonPrayer} {...cardProps} currentWeek={3} />
        </section>
      </div>
    </div>
  )
}
