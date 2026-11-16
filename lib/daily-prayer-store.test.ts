import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyPrayer } from './daily-prayer-content.ts'
import {
    classifyDailyPrayerStoreError,
    dailyPrayerContentToRow,
    loadRecentDailyPrayerTopicUses,
    saveDailyPrayerRow,
    topicUseFromDailyPrayerRow,
} from './daily-prayer-store.ts'

const TOPIC_SELECT = 'local_date, source, context_topic, journal_date, journal_entry_id, topic_key'
const LEGACY_SELECT = 'local_date, source, context_topic'

const SAMPLE_ROW = dailyPrayerContentToRow({
    userId: 'user-1',
    pairingId: 'pair-1',
    partnerId: 'learner-1',
    localDate: '2026-10-25',
    content: buildDailyPrayer({ dateKey: '2026-10-25', prayerItems: '1. peace at work' }),
    generatedBy: 'ai',
    journalEntryId: 'journal-yesterday',
    journalDate: '2026-10-24',
    topicKey: 'reflection:journal-yesterday',
})

function createStoreClient(options: {
    selectResults?: Array<{ data?: unknown[] | null; error?: { code?: string; message?: string } | null }>
    insertResults?: Array<{ error?: { code?: string; message?: string } | null }>
}) {
    const selectColumns: string[] = []
    const insertPayloads: unknown[] = []
    let selectCalls = 0
    let insertCalls = 0

    return {
        selectColumns,
        insertPayloads,
        selectCallCount: () => selectCalls,
        insertCallCount: () => insertCalls,
        from() {
            return {
                select(columns: string) {
                    selectColumns.push(columns)
                    const index = selectCalls
                    selectCalls += 1
                    const result = options.selectResults?.[index] || { data: [], error: null }
                    const payload = { data: result.data ?? null, error: result.error ?? null }
                    const chain: {
                        eq: () => typeof chain
                        order: () => typeof chain
                        limit: () => typeof chain
                        then: (
                            onFulfilled?: (value: typeof payload) => unknown,
                            onRejected?: (reason: unknown) => unknown,
                        ) => Promise<unknown>
                    } = {
                        eq: () => chain,
                        order: () => chain,
                        limit: () => chain,
                        then: (onFulfilled, onRejected) => Promise.resolve(payload).then(onFulfilled, onRejected),
                    }
                    return chain
                },
                insert(row: unknown) {
                    insertPayloads.push(row)
                    const index = insertCalls
                    insertCalls += 1
                    const result = options.insertResults?.[index] || { error: null }
                    return Promise.resolve({ error: result.error ?? null })
                },
            }
        },
    }
}

describe('daily prayer store topic columns', () => {
    it('classifies missing topic columns as unknown-column', () => {
        assert.equal(
            classifyDailyPrayerStoreError({
                code: '42703',
                message: 'column topic_key does not exist',
            }),
            'unknown-column',
        )
        assert.equal(
            classifyDailyPrayerStoreError({
                code: 'PGRST204',
                message: "Could not find the 'topic_key' column of 'daily_prayers' in the schema cache",
            }),
            'unknown-column',
        )
    })

    it('retries topic reads when Postgres says the column is missing', async () => {
        const client = createStoreClient({
            selectResults: [
                { error: { code: '42703', message: 'column topic_key does not exist' } },
                {
                    data: [{
                        local_date: '2026-10-24',
                        source: 'journal',
                        context_topic: 'peace at work',
                    }],
                },
            ],
        })
        const uses = await loadRecentDailyPrayerTopicUses(client, { userId: 'user-1', limit: 14 })
        assert.equal(client.selectCallCount(), 2)
        assert.equal(client.selectColumns[0], TOPIC_SELECT)
        assert.equal(client.selectColumns[1], LEGACY_SELECT)
        assert.equal(uses.length, 1)
        assert.equal(uses[0]?.localDate, '2026-10-24')
        assert.equal(uses[0]?.kind, 'journal')
        assert.equal(uses[0]?.topicKey, 'reflection:peace at work')
    })

    it('retries topic reads when PostgREST schema cache lacks the column', async () => {
        const client = createStoreClient({
            selectResults: [
                {
                    error: {
                        code: 'PGRST204',
                        message: "Could not find the 'journal_date' column of 'daily_prayers' in the schema cache",
                    },
                },
                {
                    data: [{
                        local_date: '2026-10-25',
                        source: 'week',
                        context_topic: 'Pray without ceasing',
                    }],
                },
            ],
        })
        const uses = await loadRecentDailyPrayerTopicUses(client, { userId: 'user-1', limit: 14 })
        assert.equal(client.selectCallCount(), 2)
        assert.equal(client.selectColumns[1], LEGACY_SELECT)
        assert.equal(uses[0]?.kind, 'week')
        assert.equal(uses[0]?.topicKey, 'assignment:Pray without ceasing')
    })

    it('retries inserts without topic columns when Postgres says they are missing', async () => {
        const client = createStoreClient({
            insertResults: [
                { error: { code: '42703', message: 'column journal_entry_id does not exist' } },
                { error: null },
            ],
        })
        const saved = await saveDailyPrayerRow(client, SAMPLE_ROW)
        assert.equal(saved, 'inserted')
        assert.equal(client.insertCallCount(), 2)
        assert.equal('topic_key' in (client.insertPayloads[0] as object), true)
        assert.equal('topic_key' in (client.insertPayloads[1] as object), false)
        assert.equal('journal_date' in (client.insertPayloads[1] as object), false)
        assert.equal('journal_entry_id' in (client.insertPayloads[1] as object), false)
    })

    it('retries inserts without topic columns when PostgREST schema cache is stale', async () => {
        const client = createStoreClient({
            insertResults: [
                {
                    error: {
                        code: 'PGRST204',
                        message: "Could not find the 'topic_key' column of 'daily_prayers' in the schema cache",
                    },
                },
                { error: null },
            ],
        })
        const saved = await saveDailyPrayerRow(client, SAMPLE_ROW)
        assert.equal(saved, 'inserted')
        assert.equal(client.insertCallCount(), 2)
        assert.equal('topic_key' in (client.insertPayloads[1] as object), false)
    })

    it('builds a topic use from an older row whose topic_key is null', () => {
        const use = topicUseFromDailyPrayerRow({
            local_date: '2026-10-24',
            source: 'journal',
            context_topic: 'peace at work',
            journal_date: '2026-10-24',
            journal_entry_id: 'journal-yesterday',
            topic_key: null,
        })
        assert.ok(use)
        assert.equal(use.kind, 'journal')
        assert.equal(use.journalDate, '2026-10-24')
        assert.equal(use.journalEntryId, 'journal-yesterday')
        assert.equal(use.topicKey, 'reflection:2026-10-24')
    })
})
