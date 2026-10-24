'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { DailyPrayerPopup } from '@/components/journal/daily-prayer-popup'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { buildDailyPrayer, type DailyPrayerContent, type DailyPrayerPartner } from '@/lib/daily-prayer-content'

const WEEK_2_GUIDED =
    "Heavenly Father, I ask you to help guide me to pray without ceasing and to continuously pray with thanksgiving and praise to the One who is able to do exceedingly and abundantly above all I could ask or think. May your kingdom purposes come and be carried out in my life as I live in obedience to Your word and Your Holy Spirit promptings. Lead me not into temptations that distract me from Your design and deliver me from evil. Forgive me of my trespasses and missteps as I forgive those who do wrong to me. Just as I have been forgiven, I will walk in forgiveness toward others."

const specPrayer: DailyPrayerContent = {
    body: "Heavenly Father, thank You for meeting me in the middle of my workday. Give me Your peace where anxiety has been loud, and help me trust You with the conversations on my heart. Teach me to slow down and listen for Your voice today. In Jesus' name I pray, Amen.",
    scriptureText: 'Do not be anxious about anything, but in everything by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
    scriptureRef: 'Philippians 4:6-7',
    source: 'journal',
    contextLabel: 'From your journal',
    contextTopic: 'peace at work',
    mentionsPartner: false,
}

const coldPrayer = buildDailyPrayer({
    dateKey: '2026-10-23',
    weekNumber: 3,
    weekTitle: 'Walking with Jesus',
    weekScripture: 'Psalm 143:8',
})

const week2Prayer = buildDailyPrayer({
    dateKey: '2026-10-24',
    weekNumber: 2,
    weekTitle: 'The New Life',
    weekScripture: '2 Corinthians 5:17 - "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come."',
    guidedPrayer: WEEK_2_GUIDED,
})

const ephPrayer = buildDailyPrayer({
    dateKey: '2026-10-23',
    weekNumber: 3,
    weekTitle: 'The New Stand',
    weekScripture: 'Ephesians 6:10-18',
})

const alex: DailyPrayerPartner = {
    pairingId: 'pairing-alex',
    userId: 'user-alex',
    name: 'Alex Rivera',
}

const jordan: DailyPrayerPartner = {
    pairingId: 'pairing-jordan',
    userId: 'user-jordan',
    name: 'Jordan Lee',
}

function PreviewInner() {
    const params = useSearchParams()
    const { setTheme } = useTheme()
    const state = params.get('state') || 'learner'
    const theme = params.get('theme') === 'light' ? 'light' : 'dark'
    const desktop = params.get('desktop') === '1'

    useEffect(() => {
        setTheme(theme)
    }, [setTheme, theme])

    const isLeaderPicker = state === 'picker'
    const isHearted = state === 'hearted'
    const isCold = state === 'cold'
    const isWeek2 = state === 'week2'
    const isEph = state === 'eph'
    const isJournal = state === 'journal'
    const content = isEph
        ? ephPrayer
        : isWeek2
            ? week2Prayer
            : isCold
                ? { ...coldPrayer, mentionsPartner: false }
                : specPrayer
    const partners = isLeaderPicker ? [alex, jordan] : [alex]

    return (
        <div className={desktop ? 'min-h-screen bg-background' : 'min-h-screen bg-background max-w-md mx-auto'}>
            <header className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs text-primary-foreground">S</span>
                    Stand Walk Run
                </div>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    SM
                </span>
            </header>
            <main className="mx-auto max-w-3xl px-5 py-8">
                <h1 className="text-[22px] font-semibold">Good morning, Sam</h1>
                <p className="mt-1 text-sm text-muted-foreground">Week 3 · Walking with Jesus</p>
                <div className="mt-5 rounded-xl border bg-card p-4">
                    <h2 className="text-sm font-medium">Today&apos;s assignment</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Read John 15 and note one way you can abide in Christ today.
                    </p>
                </div>
            </main>
            {isJournal ? (
                <DailyJournalPopup
                    pairingId="pairing-alex"
                    hasEntryToday={false}
                    leaderName="Alex"
                    open
                    onOpenChange={() => undefined}
                />
            ) : (
                <DailyPrayerPopup
                    open
                    onOpenChange={() => undefined}
                    viewerRole={isLeaderPicker ? 'leader' : 'learner'}
                    partners={partners}
                    content={content}
                    preview
                    initiallyHearted={isHearted}
                    initiallyConfirming={isLeaderPicker || state === 'send'}
                />
            )}
        </div>
    )
}

export default function DailyPrayerPreviewPage() {
    return (
        <Suspense fallback={null}>
            <PreviewInner />
        </Suspense>
    )
}
