import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
    nextDailyPopup,
    journalAppliesToday,
    prayerCloseTransition,
    claimDailyCadence,
    resetDailyCadenceClaimForTests,
} from './daily-prayer-cadence.ts'

describe('daily prayer + journal cadence', () => {
    beforeEach(() => {
        resetDailyCadenceClaimForTests()
    })

    it('shows nothing while a tour is active', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: true,
                prayerDismissedToday: false,
                prayerSettledThisSession: false,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
            null,
        )
    })

    it('shows prayer first when neither popup has been dismissed', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: false,
                prayerSettledThisSession: false,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
            'prayer',
        )
    })

    it('shows journal after prayer settles if journal is still due', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: true,
                prayerSettledThisSession: true,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
            'journal',
        )
    })

    it('does not auto-dismiss journal when prayer closes', () => {
        assert.equal(
            journalAppliesToday({
                journalHasEntryToday: false,
                journalDismissedToday: false,
            }),
            true,
        )
    })

    it('shows only prayer when the journal already has an entry today', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: false,
                prayerSettledThisSession: false,
                journalDismissedToday: false,
                journalHasEntryToday: true,
            }),
            'prayer',
        )
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: true,
                prayerSettledThisSession: true,
                journalDismissedToday: false,
                journalHasEntryToday: true,
            }),
            null,
        )
    })

    it('shows only journal when prayer was already dismissed today', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: true,
                prayerSettledThisSession: false,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
            'journal',
        )
    })

    it('treats Heart and Send as prayer dismissed for the day', () => {
        assert.equal(
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: true,
                prayerSettledThisSession: true,
                journalDismissedToday: true,
                journalHasEntryToday: false,
            }),
            null,
        )
    })

    it('never returns both popups at once', () => {
        const cases = [
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: false,
                prayerSettledThisSession: false,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
            nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: true,
                prayerSettledThisSession: true,
                journalDismissedToday: false,
                journalHasEntryToday: false,
            }),
        ]
        assert.deepEqual(cases, ['prayer', 'journal'])
        for (const kind of cases) {
            assert.ok(kind === 'prayer' || kind === 'journal')
        }
    })

    it('lets only the first cadence caller claim the dialog', () => {
        const first = claimDailyCadence()
        assert.ok(first)
        assert.equal(claimDailyCadence(), null)
    })

    it('closes prayer immediately, then opens journal after a delay when journal is due', () => {
        assert.deepEqual(prayerCloseTransition(true), {
            immediate: null,
            followUp: 'journal',
        })
        assert.deepEqual(prayerCloseTransition(false), {
            immediate: null,
            followUp: null,
        })
    })
})
