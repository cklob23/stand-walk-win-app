import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { DAILY_PRAYER_MESSAGE_PREFIX } from './daily-prayer-content.ts'
import {
    alreadySentDailyPrayerToday,
    dailyPrayerSendKey,
    forgetDailyPrayerSend,
    ALREADY_SENT_TODAY_MESSAGE,
    classifyPrayerSendWriteError,
    prayerSendFeedback,
    rememberDailyPrayerSend,
    resetDailyPrayerSendsForTests,
    resolveClientLocalDate,
    utcIsoToLocalDateKey,
    wasDailyPrayerSendRemembered,
} from './daily-prayer-send.ts'

describe('daily prayer send idempotency', () => {
    beforeEach(() => {
        resetDailyPrayerSendsForTests()
    })

    it('keys a send once per sender, recipient, and local day', () => {
        assert.equal(
            dailyPrayerSendKey('leader-1', 'learner-a', '2026-10-23'),
            'leader-1:learner-a:2026-10-23',
        )
        assert.notEqual(
            dailyPrayerSendKey('leader-1', 'learner-a', '2026-10-23'),
            dailyPrayerSendKey('leader-1', 'learner-b', '2026-10-23'),
        )
    })

    it('treats 8:30 PM ET as the previous local day, not the UTC date', () => {
        // 2026-10-24T00:30:00Z is 8:30 PM EDT on Oct 23 (UTC-4 = 240 min).
        assert.equal(utcIsoToLocalDateKey('2026-10-24T00:30:00.000Z', 240), '2026-10-23')
        assert.equal(utcIsoToLocalDateKey('2026-10-24T04:30:00.000Z', 240), '2026-10-24')
    })

    it('detects a prior Today\'s prayer on the same local day', () => {
        const messages = [{
            content: `${DAILY_PRAYER_MESSAGE_PREFIX}\n\nHeavenly Father, thank You.\n\nPhilippians 4:6-7`,
            created_at: '2026-10-24T00:30:00.000Z',
        }]
        assert.equal(
            alreadySentDailyPrayerToday({
                localDate: '2026-10-23',
                timezoneOffsetMinutes: 240,
                messages,
            }),
            true,
        )
        assert.equal(
            alreadySentDailyPrayerToday({
                localDate: '2026-10-24',
                timezoneOffsetMinutes: 240,
                messages,
            }),
            false,
        )
    })

    it('ignores ordinary chat that is not a daily prayer send', () => {
        assert.equal(
            alreadySentDailyPrayerToday({
                localDate: '2026-10-23',
                timezoneOffsetMinutes: 240,
                messages: [{
                    content: 'Hey, praying for you today',
                    created_at: '2026-10-24T00:30:00.000Z',
                }],
            }),
            false,
        )
    })

    it('remembers a send in-process so a second click is a no-op', () => {
        const key = dailyPrayerSendKey('leader-1', 'learner-a', '2026-10-23')
        assert.equal(wasDailyPrayerSendRemembered(key), false)
        rememberDailyPrayerSend(key, 1_000)
        assert.equal(wasDailyPrayerSendRemembered(key, 2_000), true)
        forgetDailyPrayerSend(key)
        assert.equal(wasDailyPrayerSendRemembered(key, 3_000), false)
    })

    it('trusts a client local date that is yesterday in UTC (evening ET)', () => {
        const resolved = resolveClientLocalDate({
            localDate: '2026-10-23',
            timezoneOffsetMinutes: 240,
            now: new Date('2026-10-24T00:30:00.000Z'),
        })
        assert.equal(resolved.localDate, '2026-10-23')
        assert.equal(resolved.timezoneOffsetMinutes, 240)
    })

    it('rejects a far-off local date and uses the offset instead', () => {
        const resolved = resolveClientLocalDate({
            localDate: '2026-01-01',
            timezoneOffsetMinutes: 240,
            now: new Date('2026-10-24T00:30:00.000Z'),
        })
        assert.equal(resolved.localDate, '2026-10-23')
    })

    it('classifies unique conflicts vs a missing prayer_sends table', () => {
        assert.equal(classifyPrayerSendWriteError({ code: '23505' }), 'duplicate')
        assert.equal(classifyPrayerSendWriteError({ code: '42P01' }), 'unavailable')
        assert.equal(classifyPrayerSendWriteError({ code: 'PGRST205' }), 'unavailable')
        assert.equal(
            classifyPrayerSendWriteError({
                message: 'Could not find the table \'public.prayer_sends\' in the schema cache',
            }),
            'unavailable',
        )
        assert.equal(classifyPrayerSendWriteError({ code: '42501', message: 'permission denied' }), 'other')
        assert.equal(classifyPrayerSendWriteError(null), 'other')
    })

    it('toasts Already sent today for a blocked repeat, not Prayer sent', () => {
        assert.equal(ALREADY_SENT_TODAY_MESSAGE, 'Already sent today')
        assert.deepEqual(
            prayerSendFeedback({ alreadySent: true }, 'Alex'),
            { tone: 'info', message: 'Already sent today' },
        )
        assert.deepEqual(
            prayerSendFeedback({ success: true }, 'Alex'),
            { tone: 'success', message: 'Prayer sent to Alex' },
        )
        assert.notEqual(
            prayerSendFeedback({ alreadySent: true }, 'Alex').message,
            prayerSendFeedback({ success: true }, 'Alex').message,
        )
        assert.deepEqual(
            prayerSendFeedback({ error: 'Not authenticated' }),
            { tone: 'error', message: 'Not authenticated' },
        )
    })
})
