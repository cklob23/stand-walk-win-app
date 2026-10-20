import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_JOURNEY_NAME, pickDefaultJourneyId } from './default-journey.ts'

describe('pickDefaultJourneyId', () => {
    it('prefers the is_default flag', () => {
        assert.equal(
            pickDefaultJourneyId([
                { id: 'named', name: DEFAULT_JOURNEY_NAME, is_default: false },
                { id: 'flagged', name: 'Another', is_default: true },
            ]),
            'flagged',
        )
    })

    it('falls back to New Believer Foundations by name', () => {
        assert.equal(
            pickDefaultJourneyId([
                { id: 'other', name: 'Advanced', is_default: false, is_available: true },
                { id: 'nbf', name: 'New Believer Foundations', is_default: false, is_available: true },
            ]),
            'nbf',
        )
    })

    it('uses the only available journey when neither flag nor name matches', () => {
        assert.equal(
            pickDefaultJourneyId([
                { id: 'only', name: 'The Journey', is_default: false, is_available: true },
            ]),
            'only',
        )
    })

    it('returns null when several journeys are available and none is default', () => {
        assert.equal(
            pickDefaultJourneyId([
                { id: 'a', name: 'One', is_available: true },
                { id: 'b', name: 'Two', is_available: true },
            ]),
            null,
        )
    })
})
