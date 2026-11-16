import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDailyPrayerInput } from './daily-prayer-content.ts'
import { topicUseFromDailyPrayerRow } from './daily-prayer-store.ts'
import {
    MAX_REFLECTION_USES,
    REFLECTION_MAX_AGE_WITH_TRACKING,
    countReflectionUses,
    dateKeyDayDiff,
    isEligibleReflection,
    pickDailyPrayerTopic,
    pickRotatedCandidate,
    shiftDateKey,
    stripIneligibleJournal,
    type DailyPrayerTopicUse,
} from './daily-prayer-topic.ts'

const WEEK = {
    weekNumber: 2,
    weekTitle: 'The New Life',
    weekScripture: '2 Corinthians 5:17',
}

const ASSIGNMENTS = [
    { week_number: 2, title: 'Pray without ceasing', guided_prayer: null, assignment_type: 'prayer' },
    { week_number: 2, title: 'Read 2 Corinthians 5', guided_prayer: null, assignment_type: 'reading' },
    { week_number: 2, title: 'Weekly meeting', guided_prayer: null, assignment_type: 'meeting' },
]

const YESTERDAY_ENTRY = {
    id: 'journal-yesterday',
    journal_date: '2026-10-24',
    prayer_items: '1. peace at work',
    god_speaking: 'God is teaching me to wait',
}

function useFor(
    localDate: string,
    pick: { kind: string; topicKey: string; journalDate?: string | null; journalEntryId?: string | null },
): DailyPrayerTopicUse {
    return {
        localDate,
        kind: pick.kind as DailyPrayerTopicUse['kind'],
        topicKey: pick.topicKey,
        journalDate: pick.journalDate || null,
        journalEntryId: pick.journalEntryId || null,
    }
}

describe('daily prayer topic selection', () => {
    it('ignores a stale reflection from weeks ago', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [{
                id: 'old',
                journal_date: '2026-09-01',
                prayer_items: '1. the same old fear',
                god_speaking: 'I wrote this weeks ago',
            }],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(pick.kind, 'journal')
        assert.equal(pick.prayerItems, null)
        assert.equal(pick.reflection, null)
        assert.equal(pick.journalDate, null)
        assert.equal(
            isEligibleReflection({
                entry: { id: 'old', journal_date: '2026-09-01', prayer_items: '1. the same old fear' },
                dateKey: '2026-10-25',
                recentUses: [],
            }),
            false,
        )
    })

    it('uses yesterday\'s reflection when it has not been used twice', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [YESTERDAY_ENTRY],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(pick.kind, 'journal')
        assert.equal(pick.journalDate, '2026-10-24')
        assert.equal(pick.journalEntryId, 'journal-yesterday')
        assert.match(pick.prayerItems || '', /peace at work/)
        assert.equal(pick.weekTitle, 'The New Life')
    })

    it('lets a given reflection inspire the prayer at most twice', () => {
        const todayEntry = {
            ...YESTERDAY_ENTRY,
            journal_date: '2026-10-25',
        }
        const first = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [todayEntry],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(first.kind, 'journal')

        const second = pickDailyPrayerTopic({
            dateKey: '2026-10-26',
            journalEntries: [todayEntry],
            recentUses: [useFor('2026-10-25', first)],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(second.kind, 'journal')
        assert.equal(countReflectionUses(todayEntry, [
            useFor('2026-10-25', first),
            useFor('2026-10-26', second),
        ]), MAX_REFLECTION_USES)

        const third = pickDailyPrayerTopic({
            dateKey: '2026-10-27',
            journalEntries: [todayEntry],
            recentUses: [useFor('2026-10-25', first), useFor('2026-10-26', second)],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(third.kind, 'journal')
        assert.equal(third.prayerItems, null)
        assert.equal(third.journalEntryId, null)
    })

    it('skips a two-day-old reflection when usage tracking is missing', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [{
                id: 'older',
                journal_date: '2026-10-23',
                prayer_items: '1. peace at work',
            }],
            recentUses: [],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(pick.kind, 'journal')
    })

    it('does not use a two-day-old reflection even when tracking shows a prior use', () => {
        assert.equal(REFLECTION_MAX_AGE_WITH_TRACKING, 1)
        const entry = {
            id: 'older',
            journal_date: '2026-10-23',
            prayer_items: '1. peace at work',
        }
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [entry],
            recentUses: [{
                localDate: '2026-10-24',
                kind: 'journal',
                topicKey: 'reflection:older',
                journalDate: '2026-10-23',
                journalEntryId: 'older',
            }],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(pick.kind, 'journal')
        assert.equal(pick.journalEntryId, null)
    })

    it('prefers yesterday over today\'s own reflection', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [
                {
                    id: 'today-entry',
                    journal_date: '2026-10-25',
                    prayer_items: '1. something from this morning',
                },
                YESTERDAY_ENTRY,
            ],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(pick.kind, 'journal')
        assert.equal(pick.journalEntryId, 'journal-yesterday')
    })

    it('keeps the same reflection after today\'s row is saved', () => {
        const first = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [YESTERDAY_ENTRY],
            recentUses: [useFor('2026-10-24', {
                kind: 'journal',
                topicKey: 'reflection:journal-yesterday',
                journalDate: '2026-10-24',
                journalEntryId: 'journal-yesterday',
            })],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(first.kind, 'journal')
        const recount = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [YESTERDAY_ENTRY],
            recentUses: [
                useFor('2026-10-24', {
                    kind: 'journal',
                    topicKey: 'reflection:journal-yesterday',
                    journalDate: '2026-10-24',
                    journalEntryId: 'journal-yesterday',
                }),
                useFor('2026-10-25', first),
            ],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(recount.kind, 'journal')
        assert.equal(recount.topicKey, first.topicKey)
        assert.equal(recount.journalEntryId, first.journalEntryId)
        assert.equal(countReflectionUses(YESTERDAY_ENTRY, [
            useFor('2026-10-24', first),
            useFor('2026-10-25', first),
        ], { excludeLocalDate: '2026-10-25' }), 1)
    })

    it('counts multiple same-day pairing rows as one use', () => {
        const entry = {
            id: 'journal-today',
            journal_date: '2026-10-25',
            prayer_items: '1. peace at work',
        }
        const pairingRows = [
            useFor('2026-10-25', {
                kind: 'journal',
                topicKey: 'reflection:journal-today',
                journalDate: '2026-10-25',
                journalEntryId: 'journal-today',
            }),
            useFor('2026-10-25', {
                kind: 'journal',
                topicKey: 'reflection:journal-today',
                journalDate: '2026-10-25',
                journalEntryId: 'journal-today',
            }),
        ]
        assert.equal(countReflectionUses(entry, pairingRows), 1)
        const secondDay = pickDailyPrayerTopic({
            dateKey: '2026-10-26',
            journalEntries: [entry],
            recentUses: pairingRows,
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(secondDay.kind, 'journal')
        assert.equal(secondDay.journalEntryId, 'journal-today')
        assert.equal(countReflectionUses(entry, [
            ...pairingRows,
            useFor('2026-10-26', secondDay),
            useFor('2026-10-26', secondDay),
        ]), 2)
    })

    it('still counts an older row whose topic_key was never stored', () => {
        const withJournalFields = topicUseFromDailyPrayerRow({
            local_date: '2026-10-24',
            source: 'journal',
            context_topic: 'peace at work',
            journal_date: '2026-10-24',
            journal_entry_id: 'journal-yesterday',
            topic_key: null,
        })
        const legacyOnly = topicUseFromDailyPrayerRow({
            local_date: '2026-10-24',
            source: 'journal',
            context_topic: 'peace at work',
            journal_date: null,
            journal_entry_id: null,
            topic_key: null,
        })
        assert.ok(withJournalFields)
        assert.ok(legacyOnly)
        assert.equal(withJournalFields.topicKey, 'reflection:2026-10-24')
        assert.equal(legacyOnly.topicKey, 'reflection:peace at work')
        assert.equal(countReflectionUses(YESTERDAY_ENTRY, [withJournalFields]), 1)
        assert.equal(countReflectionUses(YESTERDAY_ENTRY, [legacyOnly]), 1)
        assert.equal(
            isEligibleReflection({
                entry: YESTERDAY_ENTRY,
                dateKey: '2026-10-25',
                recentUses: [withJournalFields],
            }),
            true,
        )
    })

    it('ignores undated journal rows so a latest-with-no-date cannot linger', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-25',
            journalEntries: [{
                prayer_items: '1. stale because no date',
                god_speaking: 'undated',
            }],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(pick.kind, 'journal')
        const resolved = resolveDailyPrayerInput({
            dateKey: '2026-10-25',
            journalEntries: [{
                prayer_items: '1. stale because no date',
                god_speaking: 'undated',
            }],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(resolved.topicKind, 'journal')
        assert.equal(resolved.prayerItems, null)
    })

    it('rotates across assignment and uplifting topics after reflections are exhausted', () => {
        const picks: ReturnType<typeof pickDailyPrayerTopic>[] = []
        const uses: DailyPrayerTopicUse[] = [
            useFor('2026-10-24', {
                kind: 'journal',
                topicKey: 'reflection:journal-yesterday',
                journalDate: '2026-10-24',
                journalEntryId: 'journal-yesterday',
            }),
            useFor('2026-10-25', {
                kind: 'journal',
                topicKey: 'reflection:journal-yesterday',
                journalDate: '2026-10-24',
                journalEntryId: 'journal-yesterday',
            }),
        ]

        for (let offset = 0; offset < 10; offset++) {
            const dateKey = shiftDateKey('2026-10-26', offset)
            const pick = pickDailyPrayerTopic({
                dateKey,
                journalEntries: [YESTERDAY_ENTRY],
                recentUses: uses,
                ...WEEK,
                assignments: ASSIGNMENTS,
            })
            picks.push(pick)
            uses.push(useFor(dateKey, pick))
        }

        assert.equal(picks.every((pick) => pick.kind !== 'journal'), true)
        const keys = picks.map((pick) => pick.topicKey)
        assert.ok(new Set(keys).size >= 4)
        assert.ok(picks.some((pick) => pick.kind === 'week'))
        assert.ok(picks.some((pick) => pick.kind === 'encouragement'))
        assert.ok(picks.some((pick) => pick.kind === 'week' && !!pick.assignmentTitle))
        for (let i = 1; i < keys.length; i++) {
            assert.notEqual(keys[i], keys[i - 1])
        }
        assert.equal(picks.some((pick) => pick.assignmentTitle === 'Weekly meeting'), false)
    })

    it('keeps the same topic for the same local date', () => {
        const first = pickDailyPrayerTopic({
            dateKey: '2026-10-28',
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        const second = pickDailyPrayerTopic({
            dateKey: '2026-10-28',
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.equal(first.topicKey, second.topicKey)
        assert.equal(first.kind, second.kind)
    })

    it('does not repeat yesterday\'s rotated topic', () => {
        const yesterday = pickDailyPrayerTopic({
            dateKey: '2026-10-27',
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        const today = pickDailyPrayerTopic({
            dateKey: '2026-10-28',
            recentUses: [useFor('2026-10-27', yesterday)],
            ...WEEK,
            assignments: ASSIGNMENTS,
        })
        assert.notEqual(today.topicKey, yesterday.topicKey)
        assert.equal(
            pickRotatedCandidate(
                [{ topicKey: 'a' }, { topicKey: 'b' }, { topicKey: 'c' }],
                '2026-10-28',
                new Set(['a']),
            )?.topicKey === 'a',
            false,
        )
    })

    it('strips a stale journal from an already-built prayer input', () => {
        const stripped = stripIneligibleJournal({
            dateKey: '2026-10-25',
            topicKind: 'journal',
            topicKey: 'reflection:old',
            journalDate: '2026-09-01',
            journalEntryId: 'old',
            prayerItems: '1. the same old fear',
            reflection: 'weeks ago',
            weekNumber: 2,
            weekTitle: 'The New Life',
        })
        assert.equal(stripped.topicKind, 'week')
        assert.equal(stripped.prayerItems, null)
        assert.equal(stripped.journalDate, null)
    })

    it('keeps week context on uplifting days so the prayer can stay personal', () => {
        const pick = pickDailyPrayerTopic({
            dateKey: '2026-10-28',
            ...WEEK,
            assignments: ASSIGNMENTS,
            recentUses: [
                useFor('2026-10-27', { kind: 'week', topicKey: 'assignment:2:pray without ceasing' }),
            ],
        })
        if (pick.kind === 'encouragement') {
            assert.equal(pick.weekNumber, 2)
            assert.equal(pick.weekTitle, 'The New Life')
            assert.ok(pick.encouragementTheme)
        } else {
            assert.equal(pick.kind, 'week')
            assert.ok(pick.assignmentTitle || pick.weekTitle)
        }
    })

    it('counts calendar days on yyyy-mm-dd keys', () => {
        assert.equal(dateKeyDayDiff('2026-10-23', '2026-10-25'), 2)
        assert.equal(dateKeyDayDiff('2026-10-25', '2026-10-25'), 0)
        assert.equal(shiftDateKey('2026-10-25', -1), '2026-10-24')
    })
})
