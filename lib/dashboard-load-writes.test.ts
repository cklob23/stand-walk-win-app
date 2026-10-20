import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    resolveDashboardLoadWritePairingId,
    resolveSelectedPairingCookieWrite,
    shouldApplyDashboardLoadWrites,
} from './dashboard-load-writes.ts'

const completedPairing = 'pairing-beckett'
const otherActivePairing = 'pairing-paul'

describe('shouldApplyDashboardLoadWrites', () => {
    it('leak (a): blocks writes on a fresh leader session with no cookie and no ?pairing= when another learner is still active', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: null,
                activePairingCount: 2,
                role: 'leader',
            }),
            false,
        )
        assert.equal(
            resolveDashboardLoadWritePairingId({
                shownPairingId: otherActivePairing,
                urlPairingId: undefined,
                cookiePairingId: undefined,
                activePairingCount: 2,
                role: 'leader',
            }),
            null,
        )
    })

    it('leak (b): blocks writes when the cookie still names the completed pairing and the page fell back', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
                role: 'leader',
            }),
            false,
        )
        assert.equal(
            resolveDashboardLoadWritePairingId({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
                role: 'leader',
            }),
            null,
        )
    })

    it('allows writes when the URL names the pairing being shown', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: completedPairing,
                urlPairingId: completedPairing,
                cookiePairingId: null,
                activePairingCount: 2,
                role: 'leader',
            }),
            true,
        )
    })

    it('allows writes when the switcher cookie names the pairing being shown', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: otherActivePairing,
                activePairingCount: 2,
                role: 'leader',
            }),
            true,
        )
    })

    it('allows writes when the leader has exactly one active pairing', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: null,
                activePairingCount: 1,
                role: 'leader',
            }),
            true,
        )
    })

    it('allows writes for a learner viewing their pairing', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: completedPairing,
                urlPairingId: null,
                cookiePairingId: null,
                activePairingCount: 1,
                role: 'learner',
            }),
            true,
        )
    })

    it('blocks writes when a stale URL pairing falls back even if a cookie is also stale', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                urlPairingId: completedPairing,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
                role: 'leader',
            }),
            false,
        )
    })

    it('never returns a pairing id that is not the one being shown', () => {
        const writeId = resolveDashboardLoadWritePairingId({
            shownPairingId: otherActivePairing,
            urlPairingId: otherActivePairing,
            activePairingCount: 2,
            role: 'leader',
        })
        assert.equal(writeId, otherActivePairing)
        assert.notEqual(writeId, completedPairing)
    })

    it('does not write when there is no pairing on the page', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: null,
                urlPairingId: completedPairing,
                role: 'leader',
                activePairingCount: 2,
            }),
            false,
        )
    })
})

describe('resolveSelectedPairingCookieWrite', () => {
    it('leak (b): never rewrites the cookie to a fallback pairing after a completed one', () => {
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
            }),
            null,
        )
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: completedPairing,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
            }),
            null,
        )
    })

    it('leak (a): does not stamp a cookie on a fresh multi-learner session with no selection', () => {
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: null,
                activePairingCount: 2,
            }),
            null,
        )
    })

    it('persists an explicit URL selection the user navigated to', () => {
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: otherActivePairing,
                cookiePairingId: completedPairing,
                activePairingCount: 2,
            }),
            otherActivePairing,
        )
    })

    it('leaves the cookie alone when it already matches the shown pairing', () => {
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: otherActivePairing,
                activePairingCount: 2,
            }),
            null,
        )
    })

    it('may persist the only active pairing when nothing is selected', () => {
        assert.equal(
            resolveSelectedPairingCookieWrite({
                shownPairingId: otherActivePairing,
                urlPairingId: null,
                cookiePairingId: null,
                activePairingCount: 1,
            }),
            otherActivePairing,
        )
    })
})
