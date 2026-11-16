/**
 * Choose today's prayer topic so a stale journal reflection cannot linger.
 * A given reflection may inspire Today's prayer at most twice, and only when
 * it is from today, yesterday, or (with usage tracking) one more recent day.
 * Otherwise rotate across this week's journey assignments and uplifting themes.
 */

import { isLocalDateKey } from './local-date-key.ts'
import {
    dailyReflectionText,
    extractJournalTopic,
    type DailyPrayerInput,
    type DailyPrayerSource,
} from './daily-prayer-content.ts'

export const MAX_REFLECTION_USES = 2
export const REFLECTION_MAX_AGE_WITH_TRACKING = 2
export const REFLECTION_MAX_AGE_WITHOUT_TRACKING = 1
export const RECENT_TOPIC_LOOKBACK_DAYS = 7

export type DailyPrayerTopicKind = DailyPrayerSource

export interface DailyPrayerJournalEntry {
    id?: string | null
    journal_date?: string | null
    prayer_items?: string | null
    god_speaking?: string | null
}

export interface DailyPrayerTopicUse {
    localDate: string
    kind: DailyPrayerTopicKind
    topicKey: string
    journalDate?: string | null
    journalEntryId?: string | null
}

export interface DailyPrayerWeekAssignment {
    id?: string | null
    week_number?: number | null
    title?: string | null
    guided_prayer?: string | null
    assignment_type?: string | null
}

export interface DailyPrayerTopicPick {
    kind: DailyPrayerTopicKind
    topicKey: string
    prayerItems: string | null
    reflection: string | null
    weekNumber: number | null
    weekTitle: string | null
    weekScripture: string | null
    assignmentTitle: string | null
    guidedPrayer: string | null
    journalDate: string | null
    journalEntryId: string | null
    encouragementTheme: string | null
}

export const UPLIFTING_TOPICS: { id: string; label: string }[] = [
    { id: 'peace', label: "God's peace in the middle of the day" },
    { id: 'strength', label: 'strength to take the next faithful step' },
    { id: 'mercies', label: 'new mercies this morning' },
    { id: 'presence', label: 'God being with me when I feel weak' },
    { id: 'gratitude', label: 'gratitude for ordinary kindness' },
    { id: 'listening', label: 'a quiet heart that listens for God' },
    { id: 'love', label: 'love for the people in front of me' },
    { id: 'courage', label: 'courage to follow Jesus today' },
]

export function parseDateKeyUtc(dateKey: string): number | null {
    if (!isLocalDateKey(dateKey)) return null
    const [year, month, day] = dateKey.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
}

export function dateKeyDayDiff(fromKey: string, toKey: string): number | null {
    const from = parseDateKeyUtc(fromKey)
    const to = parseDateKeyUtc(toKey)
    if (from == null || to == null) return null
    return Math.round((to - from) / 86_400_000)
}

export function shiftDateKey(dateKey: string, days: number): string {
    const from = parseDateKeyUtc(dateKey)
    if (from == null) return dateKey
    return new Date(from + days * 86_400_000).toISOString().slice(0, 10)
}

export function reflectionTopicKey(entry: {
    id?: string | null
    journal_date?: string | null
}): string {
    if (entry.id) return `reflection:${entry.id}`
    if (entry.journal_date) return `reflection:${entry.journal_date}`
    return 'reflection:unknown'
}

export function hasReflectionUseTracking(uses: DailyPrayerTopicUse[]): boolean {
    return uses.some((use) => !!use.journalDate || !!use.journalEntryId)
}

export function reflectionMaxAgeDays(uses: DailyPrayerTopicUse[]): number {
    return hasReflectionUseTracking(uses)
        ? REFLECTION_MAX_AGE_WITH_TRACKING
        : REFLECTION_MAX_AGE_WITHOUT_TRACKING
}

export function countReflectionUses(
    entry: { id?: string | null; journal_date?: string | null },
    uses: DailyPrayerTopicUse[],
): number {
    const key = reflectionTopicKey(entry)
    return uses.filter((use) => {
        if (use.kind !== 'journal') return false
        if (entry.id && use.journalEntryId === entry.id) return true
        if (entry.journal_date && use.journalDate === entry.journal_date) return true
        return use.topicKey === key
    }).length
}

function journalTopicOf(entry: DailyPrayerJournalEntry): string | null {
    return extractJournalTopic(entry.prayer_items, dailyReflectionText(entry.god_speaking) || entry.god_speaking)
}

export function isEligibleReflection(input: {
    entry: DailyPrayerJournalEntry
    dateKey: string
    recentUses: DailyPrayerTopicUse[]
}): boolean {
    const journalDate = input.entry.journal_date
    if (!journalDate || !isLocalDateKey(journalDate)) return false
    if (!journalTopicOf(input.entry)) return false
    const age = dateKeyDayDiff(journalDate, input.dateKey)
    if (age == null || age < 0) return false
    if (age > reflectionMaxAgeDays(input.recentUses)) return false
    return countReflectionUses(input.entry, input.recentUses) < MAX_REFLECTION_USES
}

function rankReflectionAge(age: number): number {
    if (age === 1) return 0
    if (age === 0) return 1
    return 2
}

function collectJournalEntries(input: {
    dateKey: string
    prayerItems?: string | null
    reflection?: string | null
    journalEntries?: DailyPrayerJournalEntry[]
}): DailyPrayerJournalEntry[] {
    const collected: DailyPrayerJournalEntry[] = []
    const seen = new Set<string>()

    function push(entry: DailyPrayerJournalEntry) {
        if (!journalTopicOf(entry)) return
        const stamp = entry.id || entry.journal_date || ''
        if (!stamp || seen.has(stamp)) return
        seen.add(stamp)
        collected.push(entry)
    }

    if (extractJournalTopic(input.prayerItems, input.reflection)) {
        push({
            journal_date: input.dateKey,
            prayer_items: input.prayerItems,
            god_speaking: input.reflection,
        })
    }

    for (const entry of input.journalEntries || []) {
        push(entry)
    }

    return collected
}

function pickEligibleReflection(input: {
    dateKey: string
    prayerItems?: string | null
    reflection?: string | null
    journalEntries?: DailyPrayerJournalEntry[]
    recentUses: DailyPrayerTopicUse[]
}): DailyPrayerJournalEntry | null {
    if (!isLocalDateKey(input.dateKey)) return null

    const ranked = collectJournalEntries(input)
        .map((entry) => ({
            entry,
            age: dateKeyDayDiff(entry.journal_date || '', input.dateKey),
        }))
        .filter((row): row is { entry: DailyPrayerJournalEntry; age: number } => (
            row.age != null
            && isEligibleReflection({
                entry: row.entry,
                dateKey: input.dateKey,
                recentUses: input.recentUses,
            })
        ))
        .sort((a, b) => rankReflectionAge(a.age) - rankReflectionAge(b.age) || a.age - b.age)

    return ranked[0]?.entry || null
}

type RotatingCandidate = {
    kind: Exclude<DailyPrayerTopicKind, 'journal'>
    topicKey: string
    assignmentTitle: string | null
    guidedPrayer: string | null
    encouragementTheme: string | null
}

function assignmentCandidates(input: {
    weekNumber: number | null
    weekTitle: string | null
    assignments?: DailyPrayerWeekAssignment[]
}): RotatingCandidate[] {
    const weekNumber = input.weekNumber
    const weekRows = (input.assignments || []).filter((row) => {
        if (row.assignment_type === 'meeting') return false
        if (!weekNumber) return true
        return row.week_number == null || row.week_number === weekNumber
    })
    const candidates: RotatingCandidate[] = []
    const seen = new Set<string>()

    for (const row of weekRows) {
        const title = row.title?.trim()
        if (!title) continue
        const key = `assignment:${weekNumber || 0}:${title.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push({
            kind: 'week',
            topicKey: key,
            assignmentTitle: title,
            guidedPrayer: row.guided_prayer?.trim() || null,
            encouragementTheme: null,
        })
    }

    if (weekNumber && input.weekTitle?.trim()) {
        const title = input.weekTitle.trim()
        const key = `assignment:${weekNumber}:week:${title.toLowerCase()}`
        if (!seen.has(key)) {
            candidates.push({
                kind: 'week',
                topicKey: key,
                assignmentTitle: null,
                guidedPrayer: null,
                encouragementTheme: null,
            })
        }
    }

    return candidates
}

function upliftingCandidates(): RotatingCandidate[] {
    return UPLIFTING_TOPICS.map((topic) => ({
        kind: 'encouragement' as const,
        topicKey: `encouragement:${topic.id}`,
        assignmentTitle: null,
        guidedPrayer: null,
        encouragementTheme: topic.label,
    }))
}

function recentTopicKeys(dateKey: string, uses: DailyPrayerTopicUse[]): Set<string> {
    const keys = new Set<string>()
    for (const use of uses) {
        const age = dateKeyDayDiff(use.localDate, dateKey)
        if (age == null || age <= 0 || age > RECENT_TOPIC_LOOKBACK_DAYS) continue
        if (use.topicKey) keys.add(use.topicKey)
    }
    return keys
}

export function pickRotatedCandidate<T extends { topicKey: string }>(
    candidates: T[],
    dateKey: string,
    usedKeys: Set<string>,
): T | null {
    if (!candidates.length) return null
    const fresh = candidates.filter((candidate) => !usedKeys.has(candidate.topicKey))
    const pool = fresh.length ? fresh : candidates
    const day = dateKeyDayDiff('1970-01-01', dateKey) ?? 0
    const index = ((day % pool.length) + pool.length) % pool.length
    return pool[index] || null
}

function emptyPick(weekNumber: number | null, weekTitle: string | null, weekScripture: string | null): DailyPrayerTopicPick {
    return {
        kind: 'encouragement',
        topicKey: 'encouragement:mercies',
        prayerItems: null,
        reflection: null,
        weekNumber,
        weekTitle,
        weekScripture,
        assignmentTitle: null,
        guidedPrayer: null,
        journalDate: null,
        journalEntryId: null,
        encouragementTheme: UPLIFTING_TOPICS[2]?.label || 'new mercies this morning',
    }
}

export function pickDailyPrayerTopic(input: {
    dateKey: string
    prayerItems?: string | null
    reflection?: string | null
    journalEntries?: DailyPrayerJournalEntry[]
    recentUses?: DailyPrayerTopicUse[]
    weekNumber?: number | null
    weekTitle?: string | null
    weekScripture?: string | null
    assignments?: DailyPrayerWeekAssignment[]
}): DailyPrayerTopicPick {
    const weekNumber = input.weekNumber && input.weekNumber > 0 ? input.weekNumber : null
    const weekTitle = input.weekTitle?.trim() || null
    const weekScripture = input.weekScripture?.trim() || null
    const recentUses = input.recentUses || []

    const reflection = pickEligibleReflection({
        dateKey: input.dateKey,
        prayerItems: input.prayerItems,
        reflection: input.reflection,
        journalEntries: input.journalEntries,
        recentUses,
    })
    if (reflection) {
        return {
            kind: 'journal',
            topicKey: reflectionTopicKey(reflection),
            prayerItems: reflection.prayer_items ?? null,
            reflection: dailyReflectionText(reflection.god_speaking) || reflection.god_speaking || null,
            weekNumber,
            weekTitle,
            weekScripture,
            assignmentTitle: null,
            guidedPrayer: null,
            journalDate: reflection.journal_date || null,
            journalEntryId: reflection.id || null,
            encouragementTheme: null,
        }
    }

    const usedKeys = recentTopicKeys(input.dateKey, recentUses)
    const rotated = pickRotatedCandidate(
        [...assignmentCandidates({ weekNumber, weekTitle, assignments: input.assignments }), ...upliftingCandidates()],
        input.dateKey,
        usedKeys,
    )
    if (!rotated) return emptyPick(weekNumber, weekTitle, weekScripture)

    return {
        kind: rotated.kind,
        topicKey: rotated.topicKey,
        prayerItems: null,
        reflection: null,
        weekNumber,
        weekTitle,
        weekScripture,
        assignmentTitle: rotated.assignmentTitle,
        guidedPrayer: rotated.guidedPrayer,
        journalDate: null,
        journalEntryId: null,
        encouragementTheme: rotated.encouragementTheme,
    }
}

export function stripIneligibleJournal(
    input: DailyPrayerInput,
    recentUses: DailyPrayerTopicUse[] = [],
): DailyPrayerInput {
    const wantsJournal = input.topicKind === 'journal'
        || (!input.topicKind && !!extractJournalTopic(input.prayerItems, input.reflection))
    if (!wantsJournal) return input

    const entry: DailyPrayerJournalEntry = {
        id: input.journalEntryId,
        journal_date: input.journalDate || null,
        prayer_items: input.prayerItems,
        god_speaking: input.reflection,
    }
    if (isEligibleReflection({ entry, dateKey: input.dateKey, recentUses })) {
        return { ...input, topicKind: 'journal', topicKey: input.topicKey || reflectionTopicKey(entry) }
    }

    const fallbackKind: DailyPrayerTopicKind = input.weekNumber && input.weekTitle ? 'week' : 'encouragement'
    return {
        ...input,
        prayerItems: null,
        reflection: null,
        journalDate: null,
        journalEntryId: null,
        topicKind: fallbackKind,
        topicKey: fallbackKind === 'week'
            ? `assignment:${input.weekNumber}:week:${(input.weekTitle || '').toLowerCase()}`
            : input.topicKey || 'encouragement:mercies',
        encouragementTheme: fallbackKind === 'encouragement'
            ? (input.encouragementTheme || UPLIFTING_TOPICS[2]?.label || null)
            : null,
    }
}

export function describeChosenTopic(input: DailyPrayerInput): string {
    if (input.topicKind === 'week') {
        const focus = input.assignmentTitle?.trim() || input.weekTitle?.trim()
        return focus
            ? `this week's journey assignment: ${focus}`
            : "this week's journey"
    }
    if (input.topicKind === 'encouragement') {
        return input.encouragementTheme
            ? `a fresh uplifting prayer about ${input.encouragementTheme}`
            : 'a fresh uplifting prayer (do not return to old journal reflections)'
    }
    return input.prayerItems?.trim() || input.reflection?.trim() || 'none'
}
