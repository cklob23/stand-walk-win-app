import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    JOURNEY_COMPLETE_NOTIFICATION_TYPE,
    JOURNEY_COMPLETE_TOTAL_WEEKS,
    USER_JOURNEY_ON_CONFLICT,
    WEEK_UNLOCKED_EVENT,
    buildCompletedUserJourneyRow,
    buildJourneyCompleteNotification,
    buildWeekUnlockedMetadata,
    decideJourneyGraduationNotification,
    displayLearnerName,
    isJourneyCompleteForGraduation,
    isPostgresUniqueViolation,
    journeyCompleteHref,
    resolveJourneyTotalWeeks,
    weekUnlockRecipientIds,
} from './journey-graduation.ts'

const pairingA = {
    id: 'pairing-paul',
    leader_id: 'leader-1',
    learner_id: 'learner-paul',
    status: 'active',
    current_week: 6,
}

const pairingB = {
    id: 'pairing-sam',
    leader_id: 'leader-1',
    learner_id: 'learner-sam',
    status: 'active',
    current_week: 6,
}

describe('displayLearnerName', () => {
    it('keeps the full name used in the bell text', () => {
        assert.equal(displayLearnerName('Paul Wilder'), 'Paul Wilder')
    })

    it('falls back when the profile name is missing', () => {
        assert.equal(displayLearnerName(null), 'A learner')
        assert.equal(displayLearnerName('   '), 'A learner')
    })
})

describe('buildJourneyCompleteNotification', () => {
    it('names the learner in the title exactly once per pairing', () => {
        const payload = buildJourneyCompleteNotification({
            leaderId: pairingA.leader_id,
            pairingId: pairingA.id,
            learnerId: pairingA.learner_id,
            learnerName: 'Paul Wilder',
        })

        assert.equal(payload.user_id, 'leader-1')
        assert.equal(payload.pairing_id, 'pairing-paul')
        assert.equal(payload.type, JOURNEY_COMPLETE_NOTIFICATION_TYPE)
        assert.equal(payload.title, 'Paul Wilder has completed the 6-week journey!')
        assert.equal(payload.read, false)
        assert.equal(payload.metadata.learnerId, 'learner-paul')
        assert.equal(payload.metadata.weekNumber, 6)
        assert.equal(payload.metadata.event, 'journey_complete')
    })

    it('targets the pairing of that learner when a leader has two learners', () => {
        const paul = buildJourneyCompleteNotification({
            leaderId: pairingA.leader_id,
            pairingId: pairingA.id,
            learnerId: pairingA.learner_id,
            learnerName: 'Paul Wilder',
        })
        const sam = buildJourneyCompleteNotification({
            leaderId: pairingB.leader_id,
            pairingId: pairingB.id,
            learnerId: pairingB.learner_id,
            learnerName: 'Sam Lee',
        })

        assert.equal(paul.user_id, sam.user_id)
        assert.notEqual(paul.pairing_id, sam.pairing_id)
        assert.equal(sam.title, 'Sam Lee has completed the 6-week journey!')
        assert.equal(journeyCompleteHref(paul.pairing_id), '/dashboard?pairing=pairing-paul')
        assert.equal(journeyCompleteHref(sam.pairing_id), '/dashboard?pairing=pairing-sam')
    })
})

describe('journeyCompleteHref', () => {
    it('links the leader to that learner dashboard view', () => {
        assert.equal(
            journeyCompleteHref('pairing-paul'),
            '/dashboard?pairing=pairing-paul',
        )
    })

    it('encodes the pairing id so the query stays intact', () => {
        assert.equal(
            journeyCompleteHref('abc/def'),
            '/dashboard?pairing=abc%2Fdef',
        )
    })
})

describe('isJourneyCompleteForGraduation', () => {
    const grouped = [
        { id: 'w1', week_number: 1 },
        { id: 'w6-reading', week_number: 6 },
        { id: 'w6-meeting', week_number: 6 },
    ]

    it('is true only on week 6 when every grouped assignment is complete', () => {
        assert.equal(
            isJourneyCompleteForGraduation({
                currentWeek: 6,
                groupedAssignments: grouped,
                completedAssignmentIds: ['w1', 'w6-reading', 'w6-meeting'],
            }),
            true,
        )
    })

    it('is false before week 6 even if every row is marked complete', () => {
        assert.equal(
            isJourneyCompleteForGraduation({
                currentWeek: 5,
                groupedAssignments: grouped,
                completedAssignmentIds: ['w1', 'w6-reading', 'w6-meeting'],
            }),
            false,
        )
    })

    it('is false when a week 6 assignment is still open', () => {
        assert.equal(
            isJourneyCompleteForGraduation({
                currentWeek: 6,
                groupedAssignments: grouped,
                completedAssignmentIds: ['w1', 'w6-reading'],
            }),
            false,
        )
    })

    it('uses the journey week count when provided', () => {
        assert.equal(
            isJourneyCompleteForGraduation({
                currentWeek: 4,
                totalWeeks: 4,
                groupedAssignments: grouped,
                completedAssignmentIds: ['w1', 'w6-reading', 'w6-meeting'],
            }),
            true,
        )
    })

    it('is false when there are no assignments to complete', () => {
        assert.equal(
            isJourneyCompleteForGraduation({
                currentWeek: 6,
                groupedAssignments: [],
                completedAssignmentIds: [],
            }),
            false,
        )
    })
})

describe('decideJourneyGraduationNotification', () => {
    const completeInput = {
        pairing: pairingA,
        learnerName: 'Paul Wilder',
        isJourneyComplete: true,
        alreadyNotified: false,
    }

    it('inserts for an active pairing that just completed', () => {
        const decision = decideJourneyGraduationNotification(completeInput)
        assert.equal(decision.action, 'insert')
        if (decision.action === 'insert') {
            assert.equal(decision.payload.title, 'Paul Wilder has completed the 6-week journey!')
            assert.equal(decision.payload.pairing_id, 'pairing-paul')
            assert.equal(decision.payload.user_id, 'leader-1')
        }
    })

    it('does not insert a second time for the same pairing', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            alreadyNotified: true,
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'already_notified' })
    })

    it('skips when the leader/learner relationship is missing', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            pairing: { ...pairingA, learner_id: null },
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'missing_relationship' })
    })

    it('still inserts for a completed pairing so notify-then-complete in one request works', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            pairing: { ...pairingA, status: 'completed' },
        })
        assert.equal(decision.action, 'insert')
        if (decision.action === 'insert') {
            assert.equal(decision.payload.pairing_id, 'pairing-paul')
        }
    })

    it('skips a later Graduate to Leader click because the leader was already notified', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            alreadyNotified: true,
            pairing: { ...pairingA, status: 'completed' },
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'already_notified' })
    })

    it('skips pending pairings', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            pairing: { ...pairingA, status: 'pending' },
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'pairing_not_active' })
    })

    it('skips when assignments are not actually complete', () => {
        const decision = decideJourneyGraduationNotification({
            ...completeInput,
            isJourneyComplete: false,
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'not_complete' })
    })

    it('skips a missing pairing instead of throwing', () => {
        const decision = decideJourneyGraduationNotification({
            pairing: null,
            learnerName: 'Paul Wilder',
            isJourneyComplete: true,
            alreadyNotified: false,
        })
        assert.deepEqual(decision, { action: 'skip', reason: 'missing_pairing' })
    })
})

describe('resolveJourneyTotalWeeks', () => {
    it('uses the journey week count when present', () => {
        assert.equal(resolveJourneyTotalWeeks({ total_weeks: 8 }), 8)
        assert.equal(resolveJourneyTotalWeeks({ duration_weeks: 4 }), 4)
    })

    it('falls back to the shared constant', () => {
        assert.equal(resolveJourneyTotalWeeks(null), JOURNEY_COMPLETE_TOTAL_WEEKS)
        assert.equal(resolveJourneyTotalWeeks({ total_weeks: 0 }), JOURNEY_COMPLETE_TOTAL_WEEKS)
    })
})

describe('weekUnlockRecipientIds', () => {
    it('notifies the leader and the learner exactly once each', () => {
        assert.deepEqual(weekUnlockRecipientIds('leader-1', 'learner-1'), ['leader-1', 'learner-1'])
    })

    it('does not notify the same person twice on a self-pairing', () => {
        assert.deepEqual(weekUnlockRecipientIds('same', 'same'), ['same'])
    })
})

describe('buildCompletedUserJourneyRow', () => {
    it('matches the admin conflict target and completed shape', () => {
        assert.equal(USER_JOURNEY_ON_CONFLICT, 'user_id,journey_id')
        const row = buildCompletedUserJourneyRow({
            userId: 'learner-1',
            journeyId: 'journey-1',
            pairingId: 'pairing-1',
            completedAt: '2026-10-20T00:00:00.000Z',
        })
        assert.deepEqual(row, {
            user_id: 'learner-1',
            journey_id: 'journey-1',
            pairing_id: 'pairing-1',
            status: 'completed',
            completed_at: '2026-10-20T00:00:00.000Z',
            completion_percentage: 100,
        })
        assert.deepEqual(buildWeekUnlockedMetadata(3), {
            event: WEEK_UNLOCKED_EVENT,
            weekNumber: 3,
        })
    })
})

describe('isPostgresUniqueViolation', () => {
    it('treats 23505 as already notified so a race cannot duplicate', () => {
        assert.equal(isPostgresUniqueViolation({ code: '23505' }), true)
        assert.equal(isPostgresUniqueViolation({ code: '42501' }), false)
        assert.equal(isPostgresUniqueViolation(null), false)
    })
})
