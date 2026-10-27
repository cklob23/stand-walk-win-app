'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AssignmentCard } from '@/components/dashboard/assignment-card'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Assignment } from '@/lib/types'
import { groupAssignments } from '@/lib/assignment-grouping'
import {
  ARMOR_COMMENTARY,
  ARMOR_PRAYER,
  BAPTISM_COMMENTARY,
  BAPTISM_PRAYER,
  BIBLE_STUDY_COMMENTARY,
  BIBLE_STUDY_PRAYER,
  LEARNING_TO_PRAY_COMMENTARY,
  LEARNING_TO_PRAY_PRAYER,
  LIVE_Q1_PROMPT,
  LIVE_Q2_PROMPT,
  LIVE_Q3_PROMPT,
  LIVE_Q4_PROMPT,
  OLD_DIRECTION_COMMENTARY,
  OLD_DIRECTION_PRAYER,
  Q1_COMMENTARY,
  Q1_PRAYER,
  Q2_COMMENTARY,
  Q2_PRAYER_NOTE,
  Q3_COMMENTARY,
  Q3_PRAYER,
  Q4_COMMENTARY,
  Q4_PRAYER,
  Q5_COMMENTARY,
  Q5_PRAYER,
  QUESTION_5_PROMPT,
  SALVATION_PRAYER,
  SALVATION_STORY_COMMENTARY,
  STAND_PLAN_COMMENTARY,
  STAND_PLAN_PRAYER,
  STRENGTH_COMMENTARY,
  STRENGTH_PRAYER,
  UNDERSTANDING_PRAYER_COMMENTARY,
  UNDERSTANDING_PRAYER_PRAYER,
} from '@/lib/paul-journey-content'

const createdAt = '2026-01-01T00:00:00.000Z'

const week1Rows: Assignment[] = [
  {
    id: '7c60bfec-3e9b-4900-813c-4e3cbeafcf4f',
    week_number: 1,
    title: 'Understanding Born Again',
    description: LIVE_Q1_PROMPT,
    assignment_type: 'reading',
    order_index: 1,
    created_at: createdAt,
    commentary: Q1_COMMENTARY,
    prayer: Q1_PRAYER,
  },
  {
    id: 'd2a6bbce-9068-4871-9ca2-7999cf4d54c5',
    week_number: 1,
    title: 'Understanding Born Again',
    description: LIVE_Q2_PROMPT,
    assignment_type: 'reading',
    order_index: 2,
    created_at: createdAt,
    commentary: Q2_COMMENTARY,
    prayer: SALVATION_PRAYER,
    prayer_note: Q2_PRAYER_NOTE,
  },
  {
    id: '92d35e76-8587-4e43-9db5-ad2a4d4b9c5a',
    week_number: 1,
    title: 'Understanding Born Again',
    description: LIVE_Q3_PROMPT,
    assignment_type: 'reading',
    order_index: 3,
    created_at: createdAt,
    commentary: Q3_COMMENTARY,
    prayer: Q3_PRAYER,
  },
  {
    id: 'cacc072a-ee39-4ea8-bf16-ebbf4450a195',
    week_number: 1,
    title: 'Understanding Born Again',
    description: LIVE_Q4_PROMPT,
    assignment_type: 'reading',
    order_index: 4,
    created_at: createdAt,
    commentary: Q4_COMMENTARY,
    prayer: Q4_PRAYER,
  },
  {
    id: 'c5e0b0a1-4d2f-4a8e-9b17-3f6c8e1d2a04',
    week_number: 1,
    title: 'Understanding Born Again',
    description: QUESTION_5_PROMPT,
    assignment_type: 'reading',
    order_index: 5,
    created_at: createdAt,
    commentary: Q5_COMMENTARY,
    prayer: Q5_PRAYER,
  },
]

const salvationStory: Assignment = {
  id: 'b3073316-a82e-45ff-99e1-ab3a334799e4',
  week_number: 1,
  title: 'Your Salvation Story',
  description: 'Reflect on and write about when and how you accepted Christ. If you have not yet made this decision, write about where you are.',
  assignment_type: 'reflection',
  order_index: 6,
  created_at: createdAt,
  commentary: SALVATION_STORY_COMMENTARY,
}

const baptism: Assignment = {
  id: 'dd10ef64-f38d-4f84-b93a-31f601e9f812',
  week_number: 1,
  title: 'The Meaning of Baptism',
  description: 'Study Matthew 28:19-20 and Romans 6:3-4. Write about what baptism symbolizes and its importance.',
  assignment_type: 'reading',
  order_index: 7,
  created_at: createdAt,
  commentary: BAPTISM_COMMENTARY,
  prayer: BAPTISM_PRAYER,
}

const week1Prayer: Assignment = {
  id: '5d177ca0-5486-4c0e-a54c-50f5a1f5a5ad',
  week_number: 1,
  title: 'Prayer: Talking with Your Father',
  description: 'Read slowly and pray this out loud or in your heart.',
  assignment_type: 'prayer',
  order_index: 8,
  created_at: createdAt,
  guided_prayer: SALVATION_PRAYER,
}

const week2LearningToPray: Assignment = {
  id: '2de2f1c2-7f77-4ed3-96d5-a9cd06a5a40e',
  week_number: 2,
  title: 'Learning to Pray',
  description: 'Study Matthew 6:5-15 (The Lord\'s Prayer). Practice praying this prayer each morning, then add your own personal prayers.',
  assignment_type: 'reading',
  order_index: 1,
  created_at: createdAt,
  commentary: LEARNING_TO_PRAY_COMMENTARY,
  guided_prayer: LEARNING_TO_PRAY_PRAYER,
}

const understandingPrayer: Assignment = {
  id: '63bef6fa-c0c2-492b-9fa2-65a9a4f23645',
  week_number: 2,
  title: 'Understanding Prayer',
  description: 'Write about what prayer is and is not. How is prayer different from talking to friends?',
  assignment_type: 'reflection',
  order_index: 2,
  created_at: createdAt,
  commentary: UNDERSTANDING_PRAYER_COMMENTARY,
  prayer: UNDERSTANDING_PRAYER_PRAYER,
}

const beginningBibleStudy: Assignment = {
  id: 'preview-bible-study',
  week_number: 2,
  title: 'Beginning Bible Study',
  description: 'Start reading the Gospel of John, one chapter per day. For each chapter, write down: one thing you learned about Jesus, one question you have, and one way to apply it.',
  assignment_type: 'reading',
  order_index: 3,
  created_at: createdAt,
  commentary: BIBLE_STUDY_COMMENTARY,
  prayer: BIBLE_STUDY_PRAYER,
}

const armorOfGod: Assignment = {
  id: 'preview-armor',
  week_number: 3,
  title: 'The Armor of God',
  description: 'Read Ephesians 6:10-18. List each piece of the armor and write what each one represents.',
  assignment_type: 'reading',
  order_index: 1,
  created_at: createdAt,
  commentary: ARMOR_COMMENTARY,
  prayer: ARMOR_PRAYER,
}

const oldDirection: Assignment = {
  id: 'preview-old-direction',
  week_number: 3,
  title: 'Turning from the Old Direction',
  description: 'Honestly identify 2-3 areas in your life where you need to take a stand against evil or turn away from old patterns.',
  assignment_type: 'reflection',
  order_index: 2,
  created_at: createdAt,
  commentary: OLD_DIRECTION_COMMENTARY,
  prayer: OLD_DIRECTION_PRAYER,
}

const standPlan: Assignment = {
  id: 'preview-stand-plan',
  week_number: 3,
  title: 'Making a Stand Plan',
  description: 'For each area you identified, write a specific action plan for how you will stand firm.',
  assignment_type: 'action',
  order_index: 3,
  created_at: createdAt,
  commentary: STAND_PLAN_COMMENTARY,
  prayer: STAND_PLAN_PRAYER,
}

const prayerForStrength: Assignment = {
  id: 'preview-week3-prayer',
  week_number: 3,
  title: 'Prayer for Strength',
  description: 'Spend 10 minutes asking God for strength this week.',
  assignment_type: 'prayer',
  order_index: 1,
  created_at: createdAt,
  commentary: STRENGTH_COMMENTARY,
  guided_prayer: STRENGTH_PRAYER,
}

const cardProps = {
  pairingId: 'preview-pairing',
  userId: 'preview-learner',
  userRole: 'learner' as const,
  currentWeek: 1,
  totalWeekAssignments: 4,
  completedWeekAssignments: 0,
}

function PreviewInner() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'week1'
  const [bornAgain] = groupAssignments(week1Rows)
  const completedPrayer = {
    assignment_id: week1Prayer.id,
    status: 'completed',
    notes: null,
    completed_at: '2026-10-21T12:00:00.000Z',
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Week 1 and 2 content preview</h1>
            <p className="text-sm text-muted-foreground">
              Mock data from the live Week 1-2 ids plus Paul&apos;s commentary and prayer text. view={view}
            </p>
          </div>
          <ThemeToggle />
        </div>

        {(view === 'week1' || view === 'all') && (
          <section id="week1-expanded" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 1 expanded cards
            </h2>
            <AssignmentCard assignment={bornAgain} {...cardProps} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={salvationStory} {...cardProps} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={baptism} {...cardProps} defaultOpen guidanceDefaultOpen />
          </section>
        )}

        {(view === 'w1-prayer-unchecked' || view === 'all') && (
          <section id="w1-prayer-unchecked" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 1 guided prayer unchecked
            </h2>
            <AssignmentCard assignment={week1Prayer} {...cardProps} defaultOpen />
          </section>
        )}

        {(view === 'w1-prayer-checked' || view === 'all') && (
          <section id="w1-prayer-checked" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 1 guided prayer checked
            </h2>
            <AssignmentCard assignment={week1Prayer} {...cardProps} defaultOpen defaultPrayerConfirmed />
          </section>
        )}

        {(view === 'w1-prayer-completed' || view === 'all') && (
          <section id="w1-prayer-completed" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 1 guided prayer completed
            </h2>
            <AssignmentCard
              assignment={week1Prayer}
              {...cardProps}
              defaultOpen
              progress={completedPrayer}
            />
          </section>
        )}

        {(view === 'week2' || view === 'all') && (
          <section id="week2" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 2
            </h2>
            <AssignmentCard assignment={week2LearningToPray} {...cardProps} currentWeek={2} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={understandingPrayer} {...cardProps} currentWeek={2} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={beginningBibleStudy} {...cardProps} currentWeek={2} defaultOpen guidanceDefaultOpen />
          </section>
        )}

        {(view === 'week3' || view === 'all') && (
          <section id="week3" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week 3
            </h2>
            <AssignmentCard assignment={armorOfGod} {...cardProps} currentWeek={3} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={oldDirection} {...cardProps} currentWeek={3} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={standPlan} {...cardProps} currentWeek={3} defaultOpen guidanceDefaultOpen />
            <AssignmentCard assignment={prayerForStrength} {...cardProps} currentWeek={3} defaultOpen />
          </section>
        )}

        {(view === 'week-list' || view === 'all') && (
          <section id="week-list" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week list incomplete
            </h2>
            <AssignmentCard assignment={bornAgain} {...cardProps} />
            <AssignmentCard assignment={salvationStory} {...cardProps} />
            <AssignmentCard assignment={baptism} {...cardProps} />
            <AssignmentCard assignment={week1Prayer} {...cardProps} />
          </section>
        )}

        {(view === 'week-list-done' || view === 'all') && (
          <section id="week-list-done" className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Week list Done
            </h2>
            <AssignmentCard assignment={bornAgain} {...cardProps} />
            <AssignmentCard assignment={salvationStory} {...cardProps} />
            <AssignmentCard assignment={baptism} {...cardProps} />
            <AssignmentCard
              assignment={week1Prayer}
              {...cardProps}
              progress={completedPrayer}
            />
          </section>
        )}
      </div>
    </div>
  )
}

export default function Week12PreviewPage() {
  return (
    <Suspense fallback={null}>
      <PreviewInner />
    </Suspense>
  )
}
