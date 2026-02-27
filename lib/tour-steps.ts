import type { TourStep } from '@/components/onboarding/feature-tour'

// ── Learner Dashboard ──
export const learnerDashboardSteps: TourStep[] = [
    {
        title: 'Welcome to Your Dashboard',
        description:
            'This is your home base. Track your current week, see your scripture focus, and manage your assignments all from here.',
        targetSelector: '[data-tour="learner-week-card"]',
    },
    {
        title: 'Weekly Assignments',
        description:
            'Each week has assignments to complete -- reflections, discussions, and activities. Tap any assignment to expand it and write your response.',
        targetSelector: '[data-tour="learner-assignments"]',
    },
    {
        title: 'Your Leader',
        description:
            'Your leader is walking alongside you on this journey. You can quickly message them or view their info right from your dashboard.',
        targetSelector: '[data-tour="learner-partner"]',
    },
    {
        title: 'Navigate the App',
        description:
            'Use the tabs at the top to access the Bible reader, your Journal, Messages, your meeting Schedule, and more.',
        targetSelector: '[data-tour="dashboard-nav"]',
    },
    {
        title: '6-Week Timeline',
        description:
            'View all 6 weeks of the journey and see how far you have come. New weeks unlock as you make progress.',
        targetSelector: '[data-tour="learner-timeline"]',
    },
]

// ── Leader Dashboard ──
export const leaderDashboardSteps: TourStep[] = [
    {
        title: 'Welcome, Leader',
        description:
            'This is your command center. See your learner\'s current week, track their progress, and stay connected.',
        targetSelector: '[data-tour="leader-overview"]',
    },
    {
        title: '6-Week Journey',
        description:
            'Track your learner\'s progress through the full discipleship timeline. You can see which assignments they have completed each week.',
        targetSelector: '[data-tour="leader-timeline"]',
    },
    {
        title: 'Quick Check-In',
        description:
            'Send a quick message to your learner to encourage them or check in on their progress during the week.',
        targetSelector: '[data-tour="leader-messages"]',
    },
    {
        title: 'Navigate the App',
        description:
            'Use the tabs at the top to access the Bible, Messages, your meeting Schedule, and the Covenant agreement.',
        targetSelector: '[data-tour="dashboard-nav"]',
    },
    {
        title: 'Assignment Review',
        description:
            'Review your learner\'s responses to assignments. You can add feedback and mark assignments as reviewed.',
        targetSelector: '[data-tour="leader-assignments"]',
    },
]

// ── Bible Reader ──
export const bibleSteps: TourStep[] = [
    {
        title: 'Settings & Bible Version',
        description:
            'Tap "Settings" to adjust text size, reading voice, and audio options. Use the version dropdown to switch between ESV, KJV, NIV, NLT and other translations.',
        targetSelector: '[data-tour="bible-settings"]',
    },
    {
        title: 'Browse the Bible',
        description:
            'Select any book and chapter to read. Books are organized into Old and New Testament sections for easy navigation.',
        targetSelector: '[data-tour="bible-books"]',
    },
    {
        title: 'Highlight & Listen',
        description:
            'Use the toolbar to highlight verses or listen to the chapter read aloud. Tap any verse to add notes, share it, or save it to your journal.',
        targetSelector: '[data-tour="bible-toolbar"]',
    },
    {
        title: 'Read & Engage',
        description:
            'Tap on any verse to highlight it, add notes, share it with your partner, or journal about it. Your weekly scripture is pre-highlighted in green.',
        targetSelector: '[data-tour="bible-verses"]',
    },
]

// ── Journal ──
// Steps adapt depending on whether the user already has a journal entry today
export function getJournalSteps(hasEntryToday: boolean): TourStep[] {
    return [
        {
            title: hasEntryToday ? "Edit Today's Reflection" : 'Start a Reflection',
            description: hasEntryToday
                ? "You've already journaled today! Tap here to edit your entry, add more thoughts, or update what you're praying about."
                : 'Tap here to record your daily prayers, what God is speaking to you, and personal reflections. This is your private space to grow.',
            targetSelector: '[data-tour="journal-new"]',
        },
        {
            title: 'Shared With You',
            description:
                'When your partner shares journal entries, Bible verses, or highlights with you, they appear here.',
            targetSelector: '[data-tour="journal-shared"]',
        },
        {
            title: 'Your Entries',
            description:
                'Look back on past entries to see how God has been moving in your life throughout the program. You can share any entry with your partner.',
            targetSelector: '[data-tour="journal-history"]',
        },
    ]
}

// Static export for backward compatibility
export const journalSteps = getJournalSteps(false)

// ── Messages ──
export const messagesSteps: TourStep[] = [
    {
        title: 'Your Conversations',
        description:
            'Message your leader or learner directly. Stay connected and encouraged throughout the week. Messages are delivered in real time.',
        targetSelector: '[data-tour="messages-chat"]',
    },
    {
        title: 'Send a Message',
        description:
            'Type a message and press Enter or tap Send. Stay connected with encouragement, questions, or prayer requests.',
        targetSelector: '[data-tour="messages-input"]',
    },
]

// ── Weekly Assignments ──
export const weekDetailSteps: TourStep[] = [
    {
        title: 'Scripture Focus',
        description:
            'Each week highlights a specific scripture passage. Read it in the Bible reader by tapping "Read in Bible."',
        targetSelector: '[data-tour="week-scripture"]',
    },
    {
        title: 'Complete Assignments',
        description:
            'Tap any assignment to expand it and write your response. Your progress is tracked automatically as you complete each one.',
        targetSelector: '[data-tour="week-assignments"]',
    },
    {
        title: 'Weekly Reflection',
        description:
            'After completing assignments, write a reflection on what you learned this week. You can share it with your leader.',
        targetSelector: '[data-tour="week-reflection"]',
    },
    {
        title: 'Track Progress',
        description:
            'See your completion percentage for this week. Complete all assignments to unlock the next week.',
        targetSelector: '[data-tour="week-progress"]',
    },
]

// ── Schedule ──
export const scheduleSteps: TourStep[] = [
    {
        title: 'Manage Meetings',
        description:
            'This is where you book meetings with your leader. Pick from available time slots, or if you\'re a leader, set your availability here.',
        targetSelector: '[data-tour="schedule-main"]',
    },
    {
        title: 'Upcoming & Past Meetings',
        description:
            'See your next meeting at a glance and review past meetings. You can add upcoming meetings to your calendar so you never miss one.',
        targetSelector: '[data-tour="schedule-upcoming"]',
    },
]
