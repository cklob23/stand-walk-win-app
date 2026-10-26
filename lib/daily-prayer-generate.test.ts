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
    capPromptField,
    dailyPrayerCacheKey,
    DAILY_PRAYER_MAX_OUTPUT_TOKENS,
    finalizeGeneratedPrayer,
    isRepeatedPrayer,
    MAX_PROMPT_FIELD_CHARS,
    prayerTextKey,
    resolveTodaysPrayer,
    isDailyPrayerRendered,
    sanitizeAiPrayerBody,
    withHeavenlyFatherOpening,
} from './daily-prayer-generate.ts'
import {
    claimDailyPrayerAiAttempt,
    claimDailyPrayerAiUserSlot,
    planEnsureDailyPrayer,
    resetDailyPrayerLimitsForTests,
    resolveDuplicateDailyPrayerSave,
    resolveServerSendPrayer,
    sanitizedPartnerId,
} from './daily-prayer-limits.ts'
import {
    classifyDailyPrayerStoreError,
    dailyPrayerContentToRow,
    isAiDailyPrayerRow,
    rowToDailyPrayerContent,
} from './daily-prayer-store.ts'
import { stripEmDashes } from './daily-prayer-content.ts'

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
        assert.equal(isAiDailyPrayerRow({ generated_by: 'catalog' } as never), false)
        assert.equal(DAILY_PRAYER_MAX_OUTPUT_TOKENS, 300)
    })

    it('caps journal and week fields before they reach the prompt', () => {
        const longJournal = `1. ${'peace at work and more '.repeat(40)}`
        assert.ok(longJournal.length > MAX_PROMPT_FIELD_CHARS)
        assert.ok(capPromptField(longJournal).length <= MAX_PROMPT_FIELD_CHARS)
        const prompt = buildDailyPrayerPrompt({
            prayerInput: { dateKey: '2026-10-25', prayerItems: longJournal },
            recentBodies: [],
        })
        assert.equal(prompt.includes(longJournal), false)
        assert.ok(prompt.length < longJournal.length + 2000)
    })

    it('keeps dash-to-comma tidy in catalog copy', () => {
        assert.equal(stripEmDashes('guide me \u2014 today'), 'guide me, today')
    })
})

describe('daily prayer AI sanitizer', () => {
    it('turns today... Help me into a sentence break', () => {
        assert.equal(sanitizeAiPrayerBody('today... Help me'), 'today. Help me')
        assert.equal(sanitizeAiPrayerBody('today… Help me'), 'today. Help me')
    })

    it('keeps a space when come...and is joined', () => {
        assert.equal(sanitizeAiPrayerBody('come...and'), 'come and')
        assert.equal(sanitizeAiPrayerBody('come…and'), 'come and')
    })

    it('removes a spaced . . . ellipsis', () => {
        assert.equal(sanitizeAiPrayerBody('wait . . . now'), 'wait now')
        assert.equal(sanitizeAiPrayerBody('wait. . . now'), 'wait now')
    })

    it('removes a space before . ! ? ; : and ,', () => {
        assert.equal(sanitizeAiPrayerBody('today . Help'), 'today. Help')
        assert.equal(sanitizeAiPrayerBody('today ! Help'), 'today! Help')
        assert.equal(sanitizeAiPrayerBody('today ? Help'), 'today? Help')
        assert.equal(sanitizeAiPrayerBody('today ; Help'), 'today; Help')
        assert.equal(sanitizeAiPrayerBody('today : Help'), 'today: Help')
        assert.equal(sanitizeAiPrayerBody('guide me , today'), 'guide me, today')
    })

    it('collapses repeated openings to a single Heavenly Father', () => {
        assert.equal(
            withHeavenlyFatherOpening('Heavenly Father, Father God, give me peace.'),
            'Heavenly Father, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Dear Lord, give me peace.'),
            'Heavenly Father, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Father, give me peace.'),
            'Heavenly Father, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Dear Heavenly Father, give me peace.'),
            'Heavenly Father, give me peace.',
        )
    })

    it('only drops a bare Lord, and leaves Lord God / Lord Jesus / Lord of', () => {
        assert.equal(
            withHeavenlyFatherOpening('Lord, give me peace.'),
            'Heavenly Father, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Heavenly Father, Lord, give me peace.'),
            'Heavenly Father, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Lord God, give me peace.'),
            'Heavenly Father, Lord God, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Lord Jesus, give me peace.'),
            'Heavenly Father, Lord Jesus, give me peace.',
        )
        assert.equal(
            withHeavenlyFatherOpening('Lord of all, give me peace.'),
            'Heavenly Father, Lord of all, give me peace.',
        )
    })

    it('does not insert a space inside 1,000 or before a closing quote', () => {
        assert.equal(sanitizeAiPrayerBody('about 1,000 times'), 'about 1,000 times')
        assert.equal(sanitizeAiPrayerBody('"Be still," You said'), '"Be still," You said')
    })

    it('gates Send on the same rendered prayer body', () => {
        assert.equal(isDailyPrayerRendered(null), false)
        assert.equal(isDailyPrayerRendered({ body: '' }), false)
        assert.equal(isDailyPrayerRendered({ body: '  ' }), false)
        assert.equal(isDailyPrayerRendered({ body: 'Heavenly Father, thank You.' }), true)
    })
})

describe('daily prayer AI limits and send pick', () => {
    it('claims one AI attempt per user, pairing, and day', () => {
        resetDailyPrayerLimitsForTests()
        assert.equal(claimDailyPrayerAiAttempt('u1', 'p1', '2026-10-25'), true)
        assert.equal(claimDailyPrayerAiAttempt('u1', 'p1', '2026-10-25'), false)
        assert.equal(claimDailyPrayerAiAttempt('u1', 'p1', '2026-10-26'), true)
        assert.equal(claimDailyPrayerAiAttempt('u1', 'p2', '2026-10-25'), true)
    })

    it('rate limits a second AI call from the same user', () => {
        resetDailyPrayerLimitsForTests()
        assert.equal(claimDailyPrayerAiUserSlot('u1', 1_000), true)
        assert.equal(claimDailyPrayerAiUserSlot('u1', 1_500), false)
        assert.equal(claimDailyPrayerAiUserSlot('u1', 10_000), true)
        assert.equal(claimDailyPrayerAiUserSlot('u2', 10_100), true)
    })

    it('plans cache, generate, or catalog without looping', () => {
        assert.equal(planEnsureDailyPrayer({
            aiCached: true,
            allowGenerate: true,
            claimedAttempt: true,
            rateLimited: false,
        }), 'cache')
        assert.equal(planEnsureDailyPrayer({
            aiCached: false,
            allowGenerate: true,
            claimedAttempt: true,
            rateLimited: false,
        }), 'generate')
        assert.equal(planEnsureDailyPrayer({
            aiCached: false,
            allowGenerate: true,
            claimedAttempt: false,
            rateLimited: false,
        }), 'catalog')
        assert.equal(planEnsureDailyPrayer({
            aiCached: false,
            allowGenerate: false,
            claimedAttempt: true,
            rateLimited: false,
        }), 'catalog')
    })

    it('validates partner_id against the pairing', () => {
        const pairing = { leader_id: 'leader-1', learner_id: 'beckett' }
        assert.equal(sanitizedPartnerId(pairing, 'leader-1', 'beckett'), 'beckett')
        assert.equal(sanitizedPartnerId(pairing, 'leader-1', 'stranger'), 'beckett')
        assert.equal(sanitizedPartnerId(pairing, 'beckett', 'leader-1'), 'leader-1')
        assert.equal(sanitizedPartnerId(pairing, 'other', 'beckett'), null)
    })

    it('sends memory/AI or a saved row or server catalog, never browser text', () => {
        const memory = { body: 'Heavenly Father, from memory.' }
        const saved = { body: 'Heavenly Father, from the table.' }
        const catalog = { body: 'Heavenly Father, catalog fallback.' }
        const browser = { body: 'Heavenly Father, from the browser.' }
        assert.equal(resolveServerSendPrayer({
            memoryOrAi: memory,
            savedRow: saved,
            serverCatalog: catalog,
        }).body, memory.body)
        assert.equal(resolveServerSendPrayer({
            memoryOrAi: null,
            savedRow: saved,
            serverCatalog: catalog,
        }).body, saved.body)
        assert.equal(resolveServerSendPrayer({
            memoryOrAi: null,
            savedRow: null,
            serverCatalog: catalog,
        }).body, catalog.body)
        assert.equal(resolveServerSendPrayer({
            memoryOrAi: null,
            savedRow: null,
            serverCatalog: catalog,
        }).body.includes(browser.body), false)
    })

    it('on a unique violation uses the AI row, or keeps session AI over a catalog row', () => {
        const generated = { body: 'Heavenly Father, new AI.' }
        const existingAi = { body: 'Heavenly Father, already saved AI.' }
        const existingCatalog = { body: 'Heavenly Father, old catalog.' }
        assert.deepEqual(
            resolveDuplicateDailyPrayerSave({
                existingGeneratedBy: 'ai',
                existing: existingAi,
                generated,
            }),
            { content: existingAi, origin: 'cache' },
        )
        assert.deepEqual(
            resolveDuplicateDailyPrayerSave({
                existingGeneratedBy: 'catalog',
                existing: existingCatalog,
                generated,
            }),
            { content: generated, origin: 'ai' },
        )
    })
})
