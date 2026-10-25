import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    buildDailyPrayer,
    countWords,
    firstName,
    lookupCatalogVerse,
    MAX_PRAYER_WORDS,
} from './daily-prayer-content.ts'
import {
    buildDailyPrayerPrompt,
    dailyPrayerCacheKey,
    finalizeGeneratedPrayer,
    isRepeatedPrayer,
    prayerTextKey,
    resolveTodaysPrayer,
} from './daily-prayer-generate.ts'
import {
    classifyDailyPrayerStoreError,
    dailyPrayerContentToRow,
    rowToDailyPrayerContent,
} from './daily-prayer-store.ts'

const JOURNAL = {
    prayerItems: '1. peace at work',
    partnerName: 'Dr. Beckett Smith',
}

describe('daily prayer catalog repeats across days', () => {
    it('uses the same journal template and Philippians 4:6-7 on two consecutive days', () => {
        const yesterday = buildDailyPrayer({ dateKey: '2026-10-24', ...JOURNAL })
        const today = buildDailyPrayer({ dateKey: '2026-10-25', ...JOURNAL })
        assert.equal(yesterday.body, today.body)
        assert.equal(yesterday.scriptureRef, 'Philippians 4:6-7')
        assert.equal(today.scriptureRef, yesterday.scriptureRef)
        assert.equal(yesterday.scriptureText, today.scriptureText)
    })

    it('uses the same week prayer every day of that week', () => {
        const week = {
            weekNumber: 3,
            weekTitle: 'The New Stand',
            weekScripture: 'Ephesians 6:10-18',
        }
        const a = buildDailyPrayer({ dateKey: '2026-10-24', ...week })
        const b = buildDailyPrayer({ dateKey: '2026-10-25', ...week })
        assert.equal(a.body, b.body)
        assert.equal(a.scriptureRef, b.scriptureRef)
    })
})

describe('daily prayer AI generation', () => {
    it('puts recent prayers and allowed ESV refs in the prompt', () => {
        const prompt = buildDailyPrayerPrompt({
            prayerInput: { dateKey: '2026-10-25', ...JOURNAL },
            recentBodies: [
                'Heavenly Father, thank You for yesterday. In Jesus\' name I pray, Amen.',
            ],
        })
        assert.match(prompt, /2026-10-25/)
        assert.match(prompt, /peace at work/)
        assert.match(prompt, /thank You for yesterday/)
        assert.match(prompt, /Philippians 4:6-7/)
        assert.match(prompt, /supplication with thanksgiving/)
        assert.match(prompt, /Ephesians 6:10-11/)
        assert.equal(prompt.includes('petition'), false)
    })

    it('replaces a truncated draft verse with catalog ESV and keeps Heavenly Father under 70 words', () => {
        const long = `Heavenly Father, ${Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')} today.`
        const content = finalizeGeneratedPrayer(
            {
                body: long,
                scriptureRef: 'Philippians 4:6-7',
            },
            { dateKey: '2026-10-25', ...JOURNAL },
        )
        assert.ok(content)
        assert.match(content.body, /^Heavenly Father/)
        assert.match(content.body, /In Jesus' name I pray, Amen\.$/)
        assert.ok(countWords(content.body) <= MAX_PRAYER_WORDS)
        assert.equal(content.scriptureRef, 'Philippians 4:6-7')
        assert.equal(
            content.scriptureText,
            lookupCatalogVerse('Philippians 4:6-7')?.text,
        )
        assert.equal(content.scriptureText.includes('...'), false)
        assert.equal(firstName('St. John Rivera'), 'John')
    })

    it('rejects a draft that repeats a recent prayer', () => {
        const body = "Heavenly Father, thank You for this new day and for the chance to bring You what is on my heart. I lift up peace at work to You and ask for wisdom, peace, and a willing spirit. Help me notice Your kindness in ordinary moments. Teach me to walk with You as I go. In Jesus' name I pray, Amen."
        assert.equal(isRepeatedPrayer(body, [body]), true)
        assert.equal(
            finalizeGeneratedPrayer(
                { body, scriptureRef: 'Psalm 143:8' },
                { dateKey: '2026-10-25', ...JOURNAL },
                [body],
            ),
            null,
        )
    })

    it('falls back to the catalog when the AI call fails', async () => {
        const catalog = buildDailyPrayer({ dateKey: '2026-10-25', ...JOURNAL })
        const resolved = await resolveTodaysPrayer({
            prayerInput: { dateKey: '2026-10-25', ...JOURNAL },
            generate: async () => {
                throw new Error('gateway down')
            },
        })
        assert.equal(resolved.origin, 'catalog')
        assert.equal(resolved.content.body, catalog.body)
        assert.equal(resolved.content.scriptureRef, catalog.scriptureRef)
    })

    it('returns a cached row without calling generate', async () => {
        let calls = 0
        const cached = buildDailyPrayer({ dateKey: '2026-10-25', prayerItems: '1. patience' })
        const resolved = await resolveTodaysPrayer({
            prayerInput: { dateKey: '2026-10-25', ...JOURNAL },
            cached,
            generate: async () => {
                calls += 1
                return { body: 'should not run', scriptureRef: 'Psalm 143:8' }
            },
        })
        assert.equal(calls, 0)
        assert.equal(resolved.origin, 'cache')
        assert.equal(resolved.content.body, cached.body)
    })

    it('stores one AI prayer per user, pairing, and local date', async () => {
        const first = await resolveTodaysPrayer({
            prayerInput: { dateKey: '2026-10-24', ...JOURNAL },
            generate: async () => ({
                body: "Heavenly Father, thank You for Saturday's quiet. Give me peace at work and a listening heart. Help me walk slowly with You today. In Jesus' name I pray, Amen.",
                scriptureRef: 'Psalm 143:8',
            }),
        })
        const second = await resolveTodaysPrayer({
            prayerInput: { dateKey: '2026-10-25', ...JOURNAL },
            recentBodies: [first.content.body],
            generate: async () => ({
                body: "Heavenly Father, thank You for a new Sunday morning. Steady my thoughts at work and teach me to trust You with what I cannot fix. Keep my words kind. In Jesus' name I pray, Amen.",
                scriptureRef: 'Isaiah 41:10',
            }),
        })
        assert.equal(first.origin, 'ai')
        assert.equal(second.origin, 'ai')
        assert.notEqual(first.content.body, second.content.body)
        assert.equal(first.content.scriptureRef, 'Psalm 143:8')
        assert.equal(second.content.scriptureRef, 'Isaiah 41:10')
        assert.equal(
            dailyPrayerCacheKey('user-1', 'pair-1', '2026-10-25'),
            'user-1:pair-1:2026-10-25',
        )
        assert.notEqual(
            dailyPrayerCacheKey('user-1', 'pair-1', '2026-10-24'),
            dailyPrayerCacheKey('user-1', 'pair-1', '2026-10-25'),
        )
        assert.notEqual(
            dailyPrayerCacheKey('user-1', 'pair-beckett', '2026-10-25'),
            dailyPrayerCacheKey('user-1', 'pair-other', '2026-10-25'),
        )
    })

    it('maps a stored row back to the same prayer text used on send', () => {
        const content = buildDailyPrayer({ dateKey: '2026-10-25', ...JOURNAL })
        const row = dailyPrayerContentToRow({
            userId: 'user-1',
            pairingId: 'pair-1',
            partnerId: 'beckett',
            localDate: '2026-10-25',
            content,
            generatedBy: 'ai',
        })
        assert.equal(row.partner_id, 'beckett')
        assert.equal(row.local_date, '2026-10-25')
        assert.deepEqual(rowToDailyPrayerContent(row), content)
    })

    it('classifies a missing daily_prayers table as unavailable', () => {
        assert.equal(classifyDailyPrayerStoreError({ code: '23505' }), 'duplicate')
        assert.equal(
            classifyDailyPrayerStoreError({
                code: 'PGRST205',
                message: "Could not find the table 'public.daily_prayers' in the schema cache",
            }),
            'unavailable',
        )
        assert.equal(prayerTextKey('Heavenly Father, peace!'), 'heavenly father peace')
    })
})
