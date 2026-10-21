import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getAllIdsForGroup, groupAssignments } from './assignment-grouping.ts'
import type { Assignment } from './types.ts'

function row(partial: Partial<Assignment> & Pick<Assignment, 'id' | 'order_index' | 'description'>): Assignment {
    return {
        week_number: 1,
        title: 'Understanding Born Again',
        assignment_type: 'reading',
        created_at: '2026-01-01T00:00:00.000Z',
        commentary: null,
        prayer: null,
        ...partial,
    }
}

describe('groupAssignments commentary and prayer', () => {
    it('keeps commentary and prayer on the primary and on additional questions', () => {
        const grouped = groupAssignments([
            row({
                id: 'q1',
                order_index: 1,
                description: 'Read John 3:1-21',
                commentary: 'Commentary 1',
                prayer: 'Prayer 1',
            }),
            row({
                id: 'q2',
                order_index: 2,
                description: 'In John 3:8, what does the wind represent',
                commentary: 'Commentary 2 wind',
                prayer: 'Prayer about the wind',
            }),
            row({
                id: 'q5',
                order_index: 5,
                description: 'Romans 10:8-10 What does this passage tell us',
                commentary: 'Commentary 5 Romans',
                prayer: 'Prayer 5',
            }),
        ])

        assert.equal(grouped.length, 1)
        assert.equal(grouped[0].id, 'q1')
        assert.equal(grouped[0].commentary, 'Commentary 1')
        assert.equal(grouped[0].prayer, 'Prayer 1')
        assert.equal(grouped[0].additionalQuestions.length, 2)
        assert.deepEqual(grouped[0].additionalQuestions[0], {
            id: 'q2',
            description: 'In John 3:8, what does the wind represent',
            commentary: 'Commentary 2 wind',
            prayer: 'Prayer about the wind',
        })
        assert.equal(grouped[0].additionalQuestions[1].id, 'q5')
        assert.deepEqual(getAllIdsForGroup(grouped[0]), ['q1', 'q2', 'q5'])
    })

    it('does not add a fifth group when Q5 shares the Understanding Born Again title', () => {
        const grouped = groupAssignments([
            row({ id: 'q1', order_index: 1, description: 'Q1' }),
            row({ id: 'q2', order_index: 2, description: 'Q2' }),
            row({ id: 'q3', order_index: 3, description: 'Q3' }),
            row({ id: 'q4', order_index: 4, description: 'Q4' }),
            row({ id: 'q5', order_index: 5, description: 'Q5 Romans' }),
            row({
                id: 'story',
                order_index: 6,
                title: 'Your Salvation Story',
                assignment_type: 'reflection',
                description: 'Write your story',
            }),
        ])

        assert.equal(grouped.length, 2)
        assert.equal(grouped[0].additionalQuestions.length, 4)
    })
})
