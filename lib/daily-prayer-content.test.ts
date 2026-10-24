import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    buildDailyPrayer,
    clampPrayerBody,
    countSentences,
    countWords,
    extractJournalTopic,
    extractScriptureRef,
    firstName,
    firstPrayerItem,
    formatPrayerChip,
    formatPrayerMessage,
    formatScriptureLine,
    insertPartnerSentence,
    isShortGuidedPrayer,
    MAX_PRAYER_SENTENCES,
    MAX_PRAYER_WORDS,
    MIN_PRAYER_SENTENCES,
    listDailyPrayerVerses,
    pairScripture,
    parseScriptureDump,
    PARTNER_MENTION_MODULUS,
    PARTNER_MENTION_SENTENCE,
    retargetPartnerMention,
    sendPrayerButtonLabel,
    shouldMentionPartner,
    sanitizeVersePair,
    scriptureDisplayText,
    singleVerseText,
    stripDashSeparators,
    stripEmDashes,
} from './daily-prayer-content.ts'

const FULL_2COR_5_17 =
    'Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.'

const WEEK_2_GUIDED =
    "Heavenly Father, I ask you to help guide me to pray without ceasing and to continuously pray with thanksgiving and praise to the One who is able to do exceedingly and abundantly above all I could ask or think. May your kingdom purposes come and be carried out in my life as I live in obedience to Your word and Your Holy Spirit promptings. Lead me not into temptations that distract me from Your design and deliver me from evil. Forgive me of my trespasses and missteps as I forgive those who do wrong to me. Just as I have been forgiven, I will walk in forgiveness toward others."

const WEEK_2_SCRIPTURE =
    '2 Corinthians 5:17 - "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come."'

function dateKey(dayOfYear: number): string {
    const date = new Date(Date.UTC(2026, 0, 1 + dayOfYear))
    return date.toISOString().slice(0, 10)
}

describe('daily prayer topic sources', () => {
    it('prefers a journal prayer item as the topic', () => {
        assert.equal(firstPrayerItem('1. peace at work\n2. my kids'), 'peace at work')
        assert.equal(
            extractJournalTopic('1. peace at work\n2. my kids', 'I am learning patience'),
            'peace at work',
        )
    })

    it('falls back to reflection when prayer items are empty', () => {
        assert.equal(extractJournalTopic('  ', 'God is teaching me to wait'), 'God is teaching me to wait')
    })

    it('builds a journal-sourced prayer for the viewer, not the partner', () => {
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-24',
            prayerItems: '1. peace at work',
            partnerName: 'Alex',
        })
        assert.equal(prayer.source, 'journal')
        assert.equal(formatPrayerChip(prayer), 'From your journal · peace at work')
        assert.match(prayer.body, /^Heavenly Father/)
        assert.match(prayer.body, /In Jesus' name I pray, Amen\.$/)
        assert.ok(prayer.body.includes('peace at work'))
        assert.equal(prayer.scriptureRef, 'Philippians 4:6-7')
    })

    it('uses the current week when the journal has no topic', () => {
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-24',
            weekNumber: 3,
            weekTitle: 'The New Stand',
            weekScripture: 'Ephesians 6:10-18',
        })
        assert.equal(prayer.source, 'week')
        assert.equal(formatPrayerChip(prayer), 'Week 3 · The New Stand')
        assert.ok(prayer.body.includes('The New Stand'))
        assert.equal(prayer.scriptureRef, 'Ephesians 6:10-11')
    })

    it('reuses a short existing guided prayer for the week source', () => {
        const guided =
            "Heavenly Father, thank You for a new day to walk with You. Quiet my heart to hear Your Word, and help me take one faithful step in love toward others. In Jesus' name I pray, Amen."
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-24',
            weekNumber: 3,
            weekTitle: 'Walking with Jesus',
            guidedPrayer: guided,
        })
        assert.equal(prayer.source, 'week')
        assert.equal(prayer.body.includes('Quiet my heart to hear Your Word'), true)
        assert.equal(isShortGuidedPrayer(guided), true)
    })

    it('uses an encouraging fallback when journal and week are missing', () => {
        const prayer = buildDailyPrayer({ dateKey: '2026-10-23' })
        assert.equal(prayer.source, 'encouragement')
        assert.equal(formatPrayerChip(prayer), 'Encouragement for today')
        assert.match(prayer.body, /^Heavenly Father/)
        assert.match(prayer.body, /Amen\.$/)
    })
})

describe('partner mention frequency', () => {
    it('never mentions a partner by default on encouragement prayers', () => {
        const mentions = Array.from({ length: 40 }, (_, i) =>
            shouldMentionPartner({
                dateKey: dateKey(i),
                source: 'encouragement',
                partnerName: 'Alex',
            }),
        )
        assert.equal(mentions.some(Boolean), false)
    })

    it('never mentions a partner when no name is available', () => {
        assert.equal(
            shouldMentionPartner({
                dateKey: '2026-01-01',
                source: 'journal',
                partnerName: null,
            }),
            false,
        )
    })

    it('mentions a partner on at most 1 in 5 journal or week days', () => {
        const days = 365
        let mentions = 0
        for (let i = 0; i < days; i++) {
            if (
                shouldMentionPartner({
                    dateKey: dateKey(i),
                    source: 'journal',
                    partnerName: 'Alex Rivera',
                })
            ) {
                mentions++
            }
        }
        assert.ok(mentions > 0)
        assert.ok(mentions <= Math.ceil(days / PARTNER_MENTION_MODULUS))
        assert.ok(mentions / days <= 0.2)
    })

    it('keeps most built prayers free of the partner name', () => {
        let mentioned = 0
        for (let i = 0; i < 30; i++) {
            const prayer = buildDailyPrayer({
                dateKey: dateKey(i),
                prayerItems: '1. peace at work',
                partnerName: 'Alex',
            })
            if (prayer.mentionsPartner || prayer.body.includes('Alex')) mentioned++
        }
        assert.ok(mentioned <= 6)
        const defaultDay = buildDailyPrayer({
            dateKey: '2026-10-24',
            prayerItems: '1. peace at work',
            partnerName: 'Alex',
        })
        assert.equal(shouldMentionPartner({
            dateKey: '2026-10-24',
            source: 'journal',
            partnerName: 'Alex',
        }), defaultDay.mentionsPartner)
        if (!defaultDay.mentionsPartner) {
            assert.equal(defaultDay.body.includes('Alex'), false)
        }
    })

    it('inserts a partner sentence before the Amen when it does fit', () => {
        const withPartner = insertPartnerSentence(
            "Heavenly Father, thank You for this day. Teach me to listen. In Jesus' name I pray, Amen.",
            'Alex Rivera',
        )
        assert.match(withPartner, /Strengthen my friendship with Alex as we walk this journey/)
        assert.match(withPartner, /In Jesus' name I pray, Amen\.$/)
        assert.equal(withPartner.includes('—'), false)
    })

    it('retargets a partner mention when the leader picks a different learner', () => {
        const namedForAlex = insertPartnerSentence(
            "Heavenly Father, thank You for this day. Teach me to listen. In Jesus' name I pray, Amen.",
            'Alex Rivera',
        )
        const forSam = retargetPartnerMention(namedForAlex, 'Sam Miller')
        assert.match(forSam, /Strengthen my friendship with Sam as we walk this journey/)
        assert.equal(forSam.includes('Alex'), false)
        assert.equal(retargetPartnerMention(namedForAlex, 'Alex Rivera'), namedForAlex)
    })

    it('neutralizes a partner mention when the chosen recipient has no name', () => {
        const namedForAlex = insertPartnerSentence(
            "Heavenly Father, thank You for this day. Teach me to listen. In Jesus' name I pray, Amen.",
            'Alex Rivera',
        )
        const neutralized = retargetPartnerMention(namedForAlex, null)
        assert.equal(neutralized.includes('Alex'), false)
        assert.equal(neutralized.includes('Strengthen my friendship'), false)
        assert.match(neutralized, /In Jesus' name I pray, Amen\.$/)
    })

    it('retargets names that contain periods like J.R.', () => {
        const namedForJr = insertPartnerSentence(
            "Heavenly Father, thank You for this day. Teach me to listen. In Jesus' name I pray, Amen.",
            'J.R. Smith',
        )
        assert.match(namedForJr, /Strengthen my friendship with J\.R\. as we walk this journey/)
        const forSam = retargetPartnerMention(namedForJr, 'Sam Miller')
        assert.match(forSam, /Strengthen my friendship with Sam as we walk this journey/)
        assert.equal(forSam.includes('J.R.'), false)
        const back = retargetPartnerMention(forSam, 'J.R. Smith')
        assert.match(back, /Strengthen my friendship with J\.R\. as we walk this journey/)
        const neutralized = retargetPartnerMention(namedForJr, null)
        assert.equal(neutralized.includes('J.R.'), false)
        assert.equal(neutralized.includes('Strengthen my friendship'), false)
    })

    it('keeps mentionsPartner in sync with the partner sentence after the word cap', () => {
        let mentioned = 0
        for (let i = 0; i < 365; i++) {
            const journal = buildDailyPrayer({
                dateKey: dateKey(i),
                prayerItems: '1. peace at work and patience with my kids today',
                partnerName: 'Alex Rivera',
            })
            const week = buildDailyPrayer({
                dateKey: dateKey(i),
                weekNumber: 2,
                weekTitle: 'The New Life',
                weekScripture: WEEK_2_SCRIPTURE,
                guidedPrayer: WEEK_2_GUIDED,
                partnerName: 'J.R. Smith',
            })
            for (const prayer of [journal, week]) {
                const hasSentence = /Strengthen my friendship with \S+ as we walk this journey/.test(prayer.body)
                assert.equal(prayer.mentionsPartner, hasSentence)
                if (prayer.mentionsPartner) {
                    assert.match(prayer.body, /Strengthen my friendship/)
                    mentioned++
                } else {
                    assert.equal(prayer.body.includes('Strengthen my friendship'), false)
                }
                assert.ok(countWords(prayer.body) <= MAX_PRAYER_WORDS)
                assert.match(prayer.body, /In Jesus' name I pray, Amen\.$/)
            }
        }
        assert.ok(mentioned > 0)
        assert.ok(mentioned <= 73 * 2)
    })
})

describe('role send labels', () => {
    it('labels a learner send as Send to the leader first name', () => {
        assert.equal(sendPrayerButtonLabel('Alex Rivera'), 'Send to Alex')
    })

    it('labels a leader send as Send to the learner first name', () => {
        assert.equal(sendPrayerButtonLabel('Sam Miller'), 'Send to Sam')
    })

    it('falls back when a partner name is missing', () => {
        assert.equal(sendPrayerButtonLabel(null), 'Send to partner')
    })

    it('uses the given name after an honorific, not Dr. or Pastor', () => {
        assert.equal(firstName('Dr. Bob Smith'), 'Bob')
        assert.equal(firstName('Dr. Bob'), 'Bob')
        assert.equal(sendPrayerButtonLabel('Dr. Bob Smith'), 'Send to Bob')
        assert.equal(firstName('Pastor Alex Rivera'), 'Alex')
        assert.equal(firstName('Mrs. Sam Miller'), 'Sam')
        assert.equal(firstName('Ms. Jordan Lee'), 'Jordan')
        assert.equal(firstName('Mr. J.R. Smith'), 'J.R.')
        assert.equal(firstName('St. John Rivera'), 'John')
        assert.equal(firstName('St. Mary Lee'), 'Mary')
        assert.equal(firstName('Alex Rivera'), 'Alex')
        const named = insertPartnerSentence(
            "Heavenly Father, thank You for this day. Teach me to listen. In Jesus' name I pray, Amen.",
            'Dr. Bob Smith',
        )
        assert.match(named, /Strengthen my friendship with Bob as we walk this journey/)
        assert.equal(named.includes('Dr.'), false)
    })
})

describe('copy constraints', () => {
    it('does not use em dashes in generated copy', () => {
        const samples = [
            buildDailyPrayer({ dateKey: '2026-10-23', prayerItems: 'peace at work', partnerName: 'Alex' }),
            buildDailyPrayer({
                dateKey: '2026-10-23',
                weekNumber: 3,
                weekTitle: 'Walking with Jesus',
                partnerName: 'Alex',
            }),
            buildDailyPrayer({ dateKey: '2026-10-23' }),
        ]
        for (const prayer of samples) {
            assert.equal(prayer.body.includes('\u2014'), false)
            assert.equal(prayer.scriptureText.includes('\u2014'), false)
            assert.equal(formatPrayerChip(prayer).includes('\u2014'), false)
            assert.equal(formatPrayerMessage(prayer).includes('\u2014'), false)
        }
        assert.equal(stripEmDashes('peace — today').includes('\u2014'), false)
    })

    it('keeps prayers to 6 sentences or fewer', () => {
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-23',
            prayerItems: '1. peace at work',
            partnerName: 'Alex',
        })
        const sentences = prayer.body.split(/(?<=[.!?])\s+/).filter(Boolean)
        assert.ok(sentences.length >= 4)
        assert.ok(sentences.length <= 6)
    })

    it('caps every source at 4-6 sentences and keeps the Amen shape', () => {
        const samples = [
            buildDailyPrayer({ dateKey: '2026-10-23', prayerItems: '1. peace at work' }),
            buildDailyPrayer({
                dateKey: '2026-10-23',
                weekNumber: 2,
                weekTitle: 'The New Life',
                weekScripture: WEEK_2_SCRIPTURE,
                guidedPrayer: WEEK_2_GUIDED,
            }),
            buildDailyPrayer({
                dateKey: '2026-10-23',
                weekNumber: 3,
                weekTitle: 'Walking with Jesus',
                weekScripture: 'Ephesians 6:10-18',
            }),
            buildDailyPrayer({ dateKey: '2026-10-23' }),
        ]
        for (const prayer of samples) {
            const sentences = countSentences(prayer.body)
            assert.ok(sentences <= MAX_PRAYER_SENTENCES)
            assert.ok(countWords(prayer.body) <= MAX_PRAYER_WORDS)
            assert.match(prayer.body, /^Heavenly Father/)
            assert.match(prayer.body, /In Jesus' name I pray, Amen\.$/)
            assert.equal(prayer.body.includes(' - '), false)
            assert.equal(prayer.scriptureText.includes(' - '), false)
            assert.equal(prayer.scriptureRef.includes(' - '), false)
        }
        const journal = samples[0]
        assert.ok(countSentences(journal.body) >= MIN_PRAYER_SENTENCES)
    })

    it('trims the long Week 2 guided prayer instead of using it verbatim', () => {
        assert.ok(countSentences(WEEK_2_GUIDED) >= 5)
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 2,
            weekTitle: 'The New Life',
            weekScripture: WEEK_2_SCRIPTURE,
            guidedPrayer: WEEK_2_GUIDED,
        })
        assert.equal(prayer.source, 'week')
        assert.ok(countSentences(prayer.body) <= 4)
        assert.ok(countWords(WEEK_2_GUIDED) > 100)
        assert.ok(countWords(prayer.body) <= MAX_PRAYER_WORDS)
        assert.ok(prayer.body.includes('pray without ceasing'))
        assert.equal(prayer.body.includes('Just as I have been forgiven'), false)
        assert.match(prayer.body, /In Jesus' name I pray, Amen\.$/)
        const clamped = clampPrayerBody(WEEK_2_GUIDED, 4)
        assert.ok(clamped)
        assert.ok(countSentences(clamped) <= 4)
        assert.ok(countWords(clamped) <= MAX_PRAYER_WORDS)
    })

    it('shows the full Week 2 verse text with its own reference', () => {
        assert.equal(extractScriptureRef(WEEK_2_SCRIPTURE), '2 Corinthians 5:17')
        assert.equal(scriptureDisplayText(FULL_2COR_5_17), FULL_2COR_5_17)
        assert.equal(
            singleVerseText(FULL_2COR_5_17),
            'Therefore, if anyone is in Christ, he is a new creation.',
        )
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 2,
            weekTitle: 'The New Life',
            weekScripture: WEEK_2_SCRIPTURE,
            guidedPrayer: WEEK_2_GUIDED,
        })
        assert.equal(prayer.scriptureRef, '2 Corinthians 5:17')
        assert.equal(prayer.scriptureText, FULL_2COR_5_17)
        assert.ok(prayer.scriptureText.includes('old has passed away'))
        assert.equal(prayer.scriptureText.includes('Let me hear in the morning'), false)
        assert.equal(prayer.scriptureRef.includes(' - '), false)
        assert.equal(stripDashSeparators(WEEK_2_SCRIPTURE).includes(' - '), false)
        assert.equal(prayer.scriptureRef.includes('Psalm'), false)
        const line = formatScriptureLine(prayer.scriptureText, prayer.scriptureRef)
        assert.match(line, /\. 2 Corinthians 5:17$/)
        assert.equal(line.includes('creation.2'), false)
        assert.equal(line.includes(' - '), false)
        assert.equal(formatPrayerMessage(prayer).includes('creation.2 Corinthians'), false)
    })

    it('puts a space, not a dash, between the verse period and the reference', () => {
        const samples = [
            buildDailyPrayer({
                dateKey: '2026-10-23',
                weekNumber: 2,
                weekTitle: 'The New Life',
                weekScripture: WEEK_2_SCRIPTURE,
                guidedPrayer: WEEK_2_GUIDED,
            }),
            buildDailyPrayer({
                dateKey: '2026-10-23',
                weekNumber: 3,
                weekTitle: 'The New Stand',
                weekScripture: 'Ephesians 6:10-18',
            }),
            buildDailyPrayer({ dateKey: '2026-10-24', prayerItems: '1. peace at work' }),
        ]
        for (const prayer of samples) {
            const line = formatScriptureLine(prayer.scriptureText, prayer.scriptureRef)
            assert.equal(line, `${prayer.scriptureText} ${prayer.scriptureRef}`)
            assert.equal(line.includes(`${prayer.scriptureText}${prayer.scriptureRef}`), false)
            assert.match(line, /\. /)
            assert.equal(line.includes(' - '), false)
        }
    })

    it('shows the full range text under Ephesians 6:10-11 and Philippians 4:6-7', () => {
        const week = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 3,
            weekTitle: 'The New Stand',
            weekScripture: 'Ephesians 6:10-18',
        })
        assert.equal(week.scriptureRef, 'Ephesians 6:10-11')
        assert.match(week.scriptureText, /be strong in the Lord/)
        assert.match(week.scriptureText, /whole armor of God, that you may be able to stand against the schemes of the devil/)
        assert.equal(week.scriptureText.includes('...'), false)
        assert.ok(countSentences(week.scriptureText) >= 2)

        const journal = buildDailyPrayer({
            dateKey: '2026-10-24',
            prayerItems: '1. peace at work',
        })
        assert.equal(journal.scriptureRef, 'Philippians 4:6-7')
        assert.match(journal.scriptureText, /Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God/)
        assert.match(journal.scriptureText, /which surpasses all understanding/)
        assert.match(journal.scriptureText, /your minds in Christ Jesus/)
        assert.equal(journal.scriptureText.includes('petition'), false)
        assert.equal(journal.scriptureText.includes('present your requests'), false)
        assert.equal(journal.scriptureText.includes('...'), false)
        assert.ok(countSentences(journal.scriptureText) >= 2)

        const col = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 4,
            weekTitle: 'Walk in Him',
            weekScripture: 'Colossians 2:6-7',
        })
        assert.equal(col.scriptureRef, 'Colossians 2:6-7')
        assert.match(col.scriptureText, /just as you were taught, abounding in thanksgiving/)
    })

    it('replaces DB ellipses with catalog ESV, or drops the quote', () => {
        const fromCatalog = sanitizeVersePair({
            text: 'Do not be anxious about anything... will guard your hearts.',
            ref: 'Philippians 4:6-7',
        })
        assert.match(fromCatalog.text, /supplication with thanksgiving/)
        assert.equal(fromCatalog.text.includes('...'), false)
        assert.equal(fromCatalog.ref, 'Philippians 4:6-7')

        const dumped = parseScriptureDump(
            'Philippians 4:6-7 - "Do not be anxious about anything\u2026 will guard your hearts."',
        )
        assert.ok(dumped)
        assert.match(dumped.text, /let your requests be made known to God/)
        assert.equal(dumped.text.includes('\u2026'), false)

        const unknown = sanitizeVersePair({
            text: 'Some truncated quote... that we do not catalog.',
            ref: 'Obadiah 1:4',
        })
        assert.equal(unknown.text, '')
        assert.equal(unknown.ref, 'Obadiah 1:4')
        assert.equal(formatScriptureLine(unknown.text, unknown.ref), 'Obadiah 1:4')

        const weekDump = pairScripture({
            raw: 'Philippians 4:6-7 - "Do not be anxious... peace of God."',
            fallback: { text: 'Let me hear in the morning of your steadfast love.', ref: 'Psalm 143:8' },
        })
        assert.equal(weekDump.ref, 'Philippians 4:6-7')
        assert.match(weekDump.text, /supplication/)
        assert.equal(weekDump.text.includes('steadfast love'), false)
    })

    it('rejects ellipses or truncation marks in every catalog verse', () => {
        const verses = listDailyPrayerVerses()
        assert.ok(verses.length >= 8)
        for (const verse of verses) {
            assert.equal(verse.text.includes('...'), false, `${verse.ref} has ...`)
            assert.equal(verse.text.includes('\u2026'), false, `${verse.ref} has an ellipsis`)
            assert.ok(verse.text.trim().length > 20, `${verse.ref} looks empty`)
            assert.ok(verse.ref.trim().length > 0)
        }
    })

    it('trims even when the first sentence alone exceeds the word cap', () => {
        const longFirst = `Heavenly Father, ${Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')} today.`
        assert.ok(countWords(longFirst) > MAX_PRAYER_WORDS)
        const clamped = clampPrayerBody(longFirst)
        assert.ok(clamped)
        assert.ok(countWords(clamped) <= MAX_PRAYER_WORDS)
        assert.match(clamped, /^Heavenly Father/)
        assert.match(clamped, /In Jesus' name I pray, Amen\.$/)
        assert.ok(countSentences(clamped) <= 2)
    })

    it('never drops the Heavenly Father opening when trimming a long first sentence plus a partner line', () => {
        const longFirst = `Heavenly Father, ${Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')} today.`
        const withPartner = `${longFirst} Strengthen my friendship with Alex as we walk this journey.`
        const clamped = clampPrayerBody(withPartner, MAX_PRAYER_SENTENCES, MAX_PRAYER_WORDS, PARTNER_MENTION_SENTENCE)
        assert.ok(clamped)
        assert.match(clamped, /^Heavenly Father/)
        assert.match(clamped, /In Jesus' name I pray, Amen\.$/)
        assert.ok(countWords(clamped) <= MAX_PRAYER_WORDS)
        assert.equal(clamped.startsWith('Strengthen my friendship'), false)
    })

    it('always pairs verse text with its own reference from the same source', () => {
        const psalm = {
            text: 'Let me hear in the morning of your steadfast love, for in you I trust. Make me know the way I should go, for to you I lift up my soul.',
            ref: 'Psalm 143:8',
        }
        const fromDump = pairScripture({ raw: WEEK_2_SCRIPTURE, fallback: psalm })
        assert.equal(fromDump.ref, '2 Corinthians 5:17')
        assert.equal(fromDump.text, FULL_2COR_5_17)
        assert.equal(fromDump.text.includes('steadfast love'), false)

        const unknown = pairScripture({ raw: 'Unknown 9:9', fallback: psalm })
        assert.equal(unknown.ref, 'Psalm 143:8')
        assert.match(unknown.text, /steadfast love/)
        assert.equal(unknown.ref.includes('Corinthians'), false)

        const prayer = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 2,
            weekTitle: 'The New Life',
            weekScripture: WEEK_2_SCRIPTURE,
            guidedPrayer: WEEK_2_GUIDED,
        })
        const psalmText = prayer.scriptureText.includes('steadfast love')
        const corRef = prayer.scriptureRef.includes('Corinthians')
        assert.equal(psalmText && corRef, false)
        assert.equal(prayer.scriptureRef, '2 Corinthians 5:17')
        assert.equal(prayer.scriptureText.includes('2 Corinthians'), false)
    })

    it('caps Week 2 copy to about 60-70 words', () => {
        assert.ok(countWords(WEEK_2_GUIDED) >= 100)
        const prayer = buildDailyPrayer({
            dateKey: '2026-10-23',
            weekNumber: 2,
            weekTitle: 'The New Life',
            weekScripture: WEEK_2_SCRIPTURE,
            guidedPrayer: WEEK_2_GUIDED,
        })
        const words = countWords(prayer.body)
        assert.ok(words <= MAX_PRAYER_WORDS)
        assert.ok(words >= 40)
        assert.ok(countSentences(prayer.body) <= MAX_PRAYER_SENTENCES)
    })
})
