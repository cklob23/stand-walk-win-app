import type { DailyPrayerContent } from './daily-prayer-content.ts'
import type { DailyPrayerGeneratedBy } from './daily-prayer-generate.ts'
import type { DailyPrayerTopicUse } from './daily-prayer-topic.ts'

export interface DailyPrayerRow {
    user_id: string
    pairing_id: string
    partner_id: string | null
    local_date: string
    body: string
    scripture_text: string
    scripture_ref: string
    source: DailyPrayerContent['source']
    context_label: string
    context_topic: string | null
    mentions_partner: boolean
    generated_by: DailyPrayerGeneratedBy
    journal_entry_id?: string | null
    journal_date?: string | null
    topic_key?: string | null
}

const DAILY_PRAYER_CACHE_COLUMNS =
    'user_id, pairing_id, partner_id, local_date, body, scripture_text, scripture_ref, source, context_label, context_topic, mentions_partner, generated_by'

const DAILY_PRAYER_TOPIC_COLUMNS =
    'local_date, source, context_topic, journal_date, journal_entry_id, topic_key'

export type DailyPrayerStoreClass = 'duplicate' | 'unavailable' | 'unknown-column' | 'other'

export function classifyDailyPrayerStoreError(
    error: { code?: string | null; message?: string | null } | null | undefined,
): DailyPrayerStoreClass {
    if (!error) return 'other'
    if (error.code === '23505') return 'duplicate'
    const message = (error.message || '').toLowerCase()
    if (
        error.code === '42703'
        || error.code === 'PGRST204'
        || message.includes('journal_date')
        || message.includes('journal_entry_id')
        || message.includes('topic_key')
    ) {
        if (
            message.includes('column')
            || message.includes('schema cache')
            || message.includes('could not find')
            || error.code === '42703'
            || error.code === 'PGRST204'
        ) {
            return 'unknown-column'
        }
    }
    if (
        error.code === '42P01'
        || error.code === 'PGRST205'
        || (message.includes('daily_prayers') && (
            message.includes('does not exist')
            || message.includes('could not find')
            || message.includes('schema cache')
        ))
    ) {
        return 'unavailable'
    }
    return 'other'
}

export function rowToDailyPrayerContent(row: DailyPrayerRow): DailyPrayerContent {
    return {
        body: row.body,
        scriptureText: row.scripture_text,
        scriptureRef: row.scripture_ref,
        source: row.source,
        contextLabel: row.context_label,
        contextTopic: row.context_topic,
        mentionsPartner: row.mentions_partner,
    }
}

export function dailyPrayerContentToRow(input: {
    userId: string
    pairingId: string
    partnerId?: string | null
    localDate: string
    content: DailyPrayerContent
    generatedBy: DailyPrayerGeneratedBy
    journalEntryId?: string | null
    journalDate?: string | null
    topicKey?: string | null
}): DailyPrayerRow {
    return {
        user_id: input.userId,
        pairing_id: input.pairingId,
        partner_id: input.partnerId || null,
        local_date: input.localDate,
        body: input.content.body,
        scripture_text: input.content.scriptureText,
        scripture_ref: input.content.scriptureRef,
        source: input.content.source,
        context_label: input.content.contextLabel,
        context_topic: input.content.contextTopic,
        mentions_partner: input.content.mentionsPartner,
        generated_by: input.generatedBy,
        journal_entry_id: input.journalEntryId || null,
        journal_date: input.journalDate || null,
        topic_key: input.topicKey || null,
    }
}

function topicUseFromRow(row: {
    local_date?: string | null
    source?: string | null
    context_topic?: string | null
    journal_date?: string | null
    journal_entry_id?: string | null
    topic_key?: string | null
}): DailyPrayerTopicUse | null {
    if (!row.local_date) return null
    const kind = row.source === 'journal' || row.source === 'week' || row.source === 'encouragement'
        ? row.source
        : 'encouragement'
    const topicKey = row.topic_key
        || (kind === 'journal'
            ? `reflection:${row.journal_date || row.journal_entry_id || row.context_topic || row.local_date}`
            : kind === 'week'
                ? `assignment:${row.context_topic || row.local_date}`
                : `encouragement:${row.context_topic || row.local_date}`)
    return {
        localDate: row.local_date,
        kind,
        topicKey,
        journalDate: row.journal_date || null,
        journalEntryId: row.journal_entry_id || null,
    }
}

type SupabaseLike = {
    from: (table: string) => any
}

export async function loadDailyPrayerRow(
    supabase: SupabaseLike,
    input: { userId: string; pairingId: string; localDate: string },
): Promise<DailyPrayerRow | null> {
    const { data, error } = await supabase
        .from('daily_prayers')
        .select(DAILY_PRAYER_CACHE_COLUMNS)
        .eq('user_id', input.userId)
        .eq('pairing_id', input.pairingId)
        .eq('local_date', input.localDate)
        .maybeSingle()

    if (error && classifyDailyPrayerStoreError(error) === 'unavailable') return null
    return data || null
}

export async function loadRecentDailyPrayerBodies(
    supabase: SupabaseLike,
    input: { userId: string; limit: number },
): Promise<string[]> {
    const { data, error } = await supabase
        .from('daily_prayers')
        .select(DAILY_PRAYER_CACHE_COLUMNS)
        .eq('user_id', input.userId)
        .order('local_date', { ascending: false })
        .limit(input.limit)

    if (error || !data) return []
    return data.map((row: DailyPrayerRow) => row.body).filter(Boolean)
}

export async function loadAnyDailyPrayerForDate(
    supabase: SupabaseLike,
    input: { userId: string; localDate: string },
): Promise<DailyPrayerRow | null> {
    const { data, error } = await supabase
        .from('daily_prayers')
        .select(DAILY_PRAYER_CACHE_COLUMNS)
        .eq('user_id', input.userId)
        .eq('local_date', input.localDate)
        .order('local_date', { ascending: false })
        .limit(1)

    if (error || !data?.length) return null
    return data[0] || null
}

export function isAiDailyPrayerRow(row: DailyPrayerRow | null | undefined): row is DailyPrayerRow {
    return !!row && row.generated_by === 'ai'
}

export async function loadRecentDailyPrayerTopicUses(
    supabase: SupabaseLike,
    input: { userId: string; limit: number },
): Promise<DailyPrayerTopicUse[]> {
    const { data, error } = await supabase
        .from('daily_prayers')
        .select(DAILY_PRAYER_TOPIC_COLUMNS)
        .eq('user_id', input.userId)
        .order('local_date', { ascending: false })
        .limit(input.limit)

    if (!error && data) {
        return data.map(topicUseFromRow).filter((row: DailyPrayerTopicUse | null): row is DailyPrayerTopicUse => !!row)
    }

    if (error && classifyDailyPrayerStoreError(error) === 'unknown-column') {
        const fallback = await supabase
            .from('daily_prayers')
            .select('local_date, source, context_topic')
            .eq('user_id', input.userId)
            .order('local_date', { ascending: false })
            .limit(input.limit)
        if (fallback.error || !fallback.data) return []
        return fallback.data.map(topicUseFromRow).filter((row: DailyPrayerTopicUse | null): row is DailyPrayerTopicUse => !!row)
    }

    return []
}

export async function saveDailyPrayerRow(
    supabase: SupabaseLike,
    row: DailyPrayerRow,
): Promise<'inserted' | 'duplicate' | 'unavailable' | 'other'> {
    const { error } = await supabase.from('daily_prayers').insert(row)
    if (!error) return 'inserted'
    const kind = classifyDailyPrayerStoreError(error)
    if (kind === 'unknown-column') {
        const {
            journal_entry_id: _journalEntryId,
            journal_date: _journalDate,
            topic_key: _topicKey,
            ...legacy
        } = row
        const retry = await supabase.from('daily_prayers').insert(legacy)
        if (!retry.error) return 'inserted'
        return classifyDailyPrayerStoreError(retry.error) === 'duplicate' ? 'duplicate' : 'other'
    }
    return kind
}
