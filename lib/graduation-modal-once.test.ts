import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
    graduationModalStorageKey,
    hasSeenGraduationModal,
    markGraduationModalSeen,
    shouldAutoOpenGraduationModal,
} from './graduation-modal-once.ts'

function memoryStorage() {
    const map = new Map<string, string>()
    return {
        getItem(key: string) {
            return map.has(key) ? map.get(key)! : null
        },
        setItem(key: string, value: string) {
            map.set(key, value)
        },
        removeItem(key: string) {
            map.delete(key)
        },
        clear() {
            map.clear()
        },
        key(index: number) {
            return [...map.keys()][index] ?? null
        },
        get length() {
            return map.size
        },
    } satisfies Storage
}

describe('shouldAutoOpenGraduationModal', () => {
    it('opens once when the journey just completed', () => {
        assert.equal(
            shouldAutoOpenGraduationModal({
                isJourneyComplete: true,
                alreadyShownThisMount: false,
                alreadySeenForPairing: false,
            }),
            true,
        )
    })

    it('does not open again after AssignmentCard already showed it', () => {
        assert.equal(
            shouldAutoOpenGraduationModal({
                isJourneyComplete: true,
                alreadyShownThisMount: false,
                alreadySeenForPairing: true,
            }),
            false,
        )
    })

    it('does not open again on the same dashboard mount', () => {
        assert.equal(
            shouldAutoOpenGraduationModal({
                isJourneyComplete: true,
                alreadyShownThisMount: true,
                alreadySeenForPairing: false,
            }),
            false,
        )
    })

    it('does not open when the journey is still in progress', () => {
        assert.equal(
            shouldAutoOpenGraduationModal({
                isJourneyComplete: false,
                alreadyShownThisMount: false,
                alreadySeenForPairing: false,
            }),
            false,
        )
    })
})

describe('graduation modal session flag', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: memoryStorage(),
        })
    })

    it('is pairing-scoped so two learners do not share a seen flag', () => {
        markGraduationModalSeen('pairing-a')
        assert.equal(hasSeenGraduationModal('pairing-a'), true)
        assert.equal(hasSeenGraduationModal('pairing-b'), false)
        assert.equal(graduationModalStorageKey('pairing-a'), 'graduation-modal-seen:pairing-a')
    })
})
