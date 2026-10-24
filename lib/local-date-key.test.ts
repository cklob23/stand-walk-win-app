import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    isLocalDateKey,
    resolveJournalHasEntryToday,
    resolveLocalDateKey,
    shouldRefreshForLocalDate,
    utcDateKey,
} from './local-date-key.ts'

describe('local date key', () => {
    it('accepts yyyy-MM-dd and rejects anything else', () => {
        assert.equal(isLocalDateKey('2026-10-23'), true)
        assert.equal(isLocalDateKey('10/23/2026'), false)
        assert.equal(isLocalDateKey(''), false)
        assert.equal(isLocalDateKey(null), false)
    })

    it('prefers URL date, then the device cookie, then UTC', () => {
        const now = new Date('2026-10-24T00:30:00.000Z')
        assert.equal(
            resolveLocalDateKey({ urlDate: '2026-10-23', cookieDate: '2026-10-22', now }),
            '2026-10-23',
        )
        assert.equal(
            resolveLocalDateKey({ urlDate: 'not-a-date', cookieDate: '2026-10-23', now }),
            '2026-10-23',
        )
        assert.equal(
            resolveLocalDateKey({ urlDate: null, cookieDate: null, now }),
            utcDateKey(now),
        )
        assert.equal(utcDateKey(now), '2026-10-24')
    })

    it('uses the cookie after 8 PM ET so journal-today matches the popup', () => {
        const now = new Date('2026-10-24T00:30:00.000Z')
        assert.equal(
            resolveLocalDateKey({ cookieDate: '2026-10-23', now }),
            '2026-10-23',
        )
        assert.notEqual(
            resolveLocalDateKey({ cookieDate: '2026-10-23', now }),
            utcDateKey(now),
        )
    })

    it('refreshes when the cookie is missing or still yesterday', () => {
        assert.equal(shouldRefreshForLocalDate(null, '2026-10-24'), true)
        assert.equal(shouldRefreshForLocalDate('2026-10-23', '2026-10-24'), true)
        assert.equal(shouldRefreshForLocalDate('2026-10-24', '2026-10-24'), false)
        assert.equal(shouldRefreshForLocalDate('2026-10-24', 'not-a-date'), false)
    })

    it('does not treat yesterday\'s journal entry as today on first load', () => {
        assert.equal(
            resolveJournalHasEntryToday({
                queriedDate: '2026-10-23',
                hasEntryOnQueriedDate: true,
                deviceDate: '2026-10-24',
            }),
            false,
        )
        assert.equal(
            resolveJournalHasEntryToday({
                queriedDate: '2026-10-24',
                hasEntryOnQueriedDate: true,
                deviceDate: '2026-10-24',
            }),
            true,
        )
        assert.equal(
            resolveJournalHasEntryToday({
                queriedDate: '2026-10-24',
                hasEntryOnQueriedDate: false,
                deviceDate: '2026-10-24',
            }),
            false,
        )
        assert.equal(
            resolveJournalHasEntryToday({
                queriedDate: null,
                hasEntryOnQueriedDate: true,
                deviceDate: '2026-10-24',
            }),
            false,
        )
    })
})
