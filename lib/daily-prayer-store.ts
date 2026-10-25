import type { DailyPrayerContent } from './daily-prayer-content.ts'
import type { DailyPrayerGeneratedBy } from './daily-prayer-generate.ts'

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
}

export type DailyPrayerStoreClass = 'duplicate' | 'unavailable' | 'other'

export function classifyDailyPrayerStoreError(
    error: { code?: string | null; message?: string | null } | null | undefined,
): DailyPrayerStoreClass {
    if (!error) return 'other'
    if (error.code === '23505') return 'duplicate'
    const message = (error.message || '').toLowerCase()
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
        .select('user_id, pairing_id, partner_id, local_date, body, scripture_text, scripture_ref, source, context_label, context_topic, mentions_partner, generated_by')
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
        .select('user_id, pairing_id, partner_id, local_date, body, scripture_text, scripture_ref, source, context_label, context_topic, mentions_partner, generated_by')
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
        .select('user_id, pairing_id, partner_id, local_date, body, scripture_text, scripture_ref, source, context_label, context_topic, mentions_partner, generated_by')
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

export async function saveDailyPrayerRow(
    supabase: SupabaseLike,
    row: DailyPrayerRow,
): Promise<'inserted' | 'duplicate' | 'unavailable' | 'other'> {
    const { error } = await supabase.from('daily_prayers').insert(row)
    if (!error) return 'inserted'
    return classifyDailyPrayerStoreError(error)
}
