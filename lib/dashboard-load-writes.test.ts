import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    resolveDashboardLoadWritePairingId,
    shouldApplyDashboardLoadWrites,
} from './dashboard-load-writes.ts'

const completedPairing = 'pairing-beckett'
const otherActivePairing = 'pairing-paul'

describe('shouldApplyDashboardLoadWrites', () => {
    it('allows writes on the pairing being shown when nothing was requested', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [null, undefined],
            }),
            true,
        )
    })

    it('allows writes when the URL or cookie names the pairing being shown', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: completedPairing,
                requestedPairingIds: [completedPairing, null],
            }),
            true,
        )
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [null, otherActivePairing],
            }),
            true,
        )
    })

    it('blocks writes when a completed pairing was requested and the page fell back to another learner', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [completedPairing, completedPairing],
            }),
            false,
        )
        assert.equal(
            resolveDashboardLoadWritePairingId({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [completedPairing],
            }),
            null,
        )
    })

    it('blocks writes when a stale URL pairing falls back even if a cookie is also stale', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [completedPairing, completedPairing],
            }),
            false,
        )
    })

    it('allows writes to the cookie pairing when only the URL is a completed leftover', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [completedPairing, otherActivePairing],
            }),
            true,
        )
        assert.equal(
            resolveDashboardLoadWritePairingId({
                shownPairingId: otherActivePairing,
                requestedPairingIds: [completedPairing, otherActivePairing],
            }),
            otherActivePairing,
        )
    })

    it('never returns a pairing id that is not the one being shown', () => {
        const writeId = resolveDashboardLoadWritePairingId({
            shownPairingId: otherActivePairing,
            requestedPairingIds: [otherActivePairing],
        })
        assert.equal(writeId, otherActivePairing)
        assert.notEqual(writeId, completedPairing)
    })

    it('does not write when there is no pairing on the page', () => {
        assert.equal(
            shouldApplyDashboardLoadWrites({
                shownPairingId: null,
                requestedPairingIds: [completedPairing],
            }),
            false,
        )
        assert.equal(
            resolveDashboardLoadWritePairingId({
                shownPairingId: undefined,
                requestedPairingIds: [],
            }),
            null,
        )
    })
})
