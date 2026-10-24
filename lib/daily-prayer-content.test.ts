import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    buildDailyPrayer,
    extractJournalTopic,
    firstPrayerItem,
    formatPrayerChip,
    formatPrayerMessage,
    insertPartnerSentence,
    isShortGuidedPrayer,
    PARTNER_MENTION_MODULUS,
    sendPrayerButtonLabel,
    shouldMentionPartner,
    stripEmDashes,
} from './daily-prayer-content.ts'

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
})
