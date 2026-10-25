'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyNewMessage } from '@/lib/notifications'
import { generateDailyPrayerDraft } from '@/lib/daily-prayer-ai'
import {
    formatPrayerMessage,
    retargetPartnerMention,
    type DailyPrayerContent,
    type DailyPrayerInput,
} from '@/lib/daily-prayer-content'
import {
    DAILY_PRAYER_RECENT_LIMIT,
    resolveTodaysPrayer,
    type DailyPrayerOrigin,
} from '@/lib/daily-prayer-generate'
import {
    dailyPrayerContentToRow,
    loadAnyDailyPrayerForDate,
    loadDailyPrayerRow,
    loadRecentDailyPrayerBodies,
    rowToDailyPrayerContent,
    saveDailyPrayerRow,
} from '@/lib/daily-prayer-store'
import {
    alreadySentDailyPrayerToday,
    classifyPrayerSendWriteError,
    dailyPrayerSendKey,
    forgetDailyPrayerSend,
    rememberDailyPrayerSend,
    resolveClientLocalDate,
    wasDailyPrayerSendRemembered,
} from '@/lib/daily-prayer-send'

export type SendDailyPrayerResult =
    | { success: true }
    | { alreadySent: true }
    | { error: string }

export type EnsureTodaysPrayerResult = {
    content: DailyPrayerContent
    origin: DailyPrayerOrigin
}

export async function ensureTodaysPrayer(input: {
    pairingId: string
    partnerUserId?: string | null
    partnerName?: string | null
    localDate?: string
    timezoneOffsetMinutes?: number
    prayerInput?: Omit<DailyPrayerInput, 'dateKey' | 'partnerName'>
}): Promise<EnsureTodaysPrayerResult | { error: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const pairing = await loadViewerPairing(supabase, user.id, input.pairingId)
    if (!pairing) return { error: 'Pairing not found' }

    const { localDate } = resolveClientLocalDate({
        localDate: input.localDate,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
    })
    const partnerId = input.partnerUserId
        || (pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id)
        || null

    return loadOrCreateTodaysPrayer({
        supabase,
        userId: user.id,
        pairingId: pairing.id,
        partnerId,
        partnerName: input.partnerName || null,
        localDate,
        prayerInput: input.prayerInput || {},
        preferSameDay: false,
    })
}

export async function sendDailyPrayerToPartner(input: {
    pairingId: string
    partnerUserId: string
    prayerBody: string
    scriptureText: string
    scriptureRef: string
    localDate?: string
    timezoneOffsetMinutes?: number
    prayerInput?: Omit<DailyPrayerInput, 'dateKey' | 'partnerName'>
}): Promise<SendDailyPrayerResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('id, leader_id, learner_id')
        .eq('id', input.pairingId)
        .maybeSingle()

    if (!pairing) return { error: 'Pairing not found' }

    const isLeader = pairing.leader_id === user.id
    const isLearner = pairing.learner_id === user.id
    if (!isLeader && !isLearner) return { error: 'You are not part of this pairing' }

    const expectedPartnerId = isLeader ? pairing.learner_id : pairing.leader_id
    if (!expectedPartnerId || expectedPartnerId !== input.partnerUserId) {
        return { error: 'Choose a partner from this pairing' }
    }

    const { localDate, timezoneOffsetMinutes } = resolveClientLocalDate({
        localDate: input.localDate,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
    })
    const sendKey = dailyPrayerSendKey(user.id, input.partnerUserId, localDate)
    if (wasDailyPrayerSendRemembered(sendKey)) {
        return { alreadySent: true }
    }

    const reserved = await reserveDailyPrayerSend(supabase, {
        senderId: user.id,
        recipientId: input.partnerUserId,
        pairingId: pairing.id,
        localDate,
        timezoneOffsetMinutes,
    })
    if (reserved === 'duplicate') {
        rememberDailyPrayerSend(sendKey)
        return { alreadySent: true }
    }
    rememberDailyPrayerSend(sendKey)

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', [user.id, input.partnerUserId])

    const senderName = profiles?.find((row) => row.id === user.id)?.full_name || 'Your partner'
    const recipientName = profiles?.find((row) => row.id === input.partnerUserId)?.full_name || null

    const resolved = await loadOrCreateTodaysPrayer({
        supabase,
        userId: user.id,
        pairingId: pairing.id,
        partnerId: input.partnerUserId,
        partnerName: recipientName,
        localDate,
        prayerInput: input.prayerInput || {},
        preferSameDay: true,
    })
    const prayer = 'content' in resolved ? resolved.content : {
        body: input.prayerBody,
        scriptureText: input.scriptureText,
        scriptureRef: input.scriptureRef,
    }

    const content = formatPrayerMessage({
        body: retargetPartnerMention(prayer.body, recipientName),
        scriptureText: prayer.scriptureText,
        scriptureRef: prayer.scriptureRef,
    })

    const { error } = await supabase.from('messages').insert({
        pairing_id: pairing.id,
        sender_id: user.id,
        content,
    })

    if (error) {
        forgetDailyPrayerSend(sendKey)
        if (reserved === 'inserted') {
            await supabase
                .from('prayer_sends')
                .delete()
                .eq('sender_id', user.id)
                .eq('recipient_id', input.partnerUserId)
                .eq('local_date', localDate)
        }
        return { error: error.message }
    }

    await notifyNewMessage(
        input.partnerUserId,
        senderName,
        pairing.id,
        content,
    )

    revalidatePath('/dashboard/messages')
    revalidatePath('/dashboard')
    return { success: true }
}

async function reserveDailyPrayerSend(
    supabase: Awaited<ReturnType<typeof createClient>>,
    input: {
        senderId: string
        recipientId: string
        pairingId: string
        localDate: string
        timezoneOffsetMinutes: number
    },
): Promise<'inserted' | 'duplicate' | 'fallback-ok'> {
    const { error } = await supabase.from('prayer_sends').insert({
        sender_id: input.senderId,
        recipient_id: input.recipientId,
        pairing_id: input.pairingId,
        local_date: input.localDate,
    })

    if (!error) return 'inserted'

    const kind = classifyPrayerSendWriteError(error)
    if (kind === 'duplicate') return 'duplicate'

    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    const { data: recentMessages } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('pairing_id', input.pairingId)
        .eq('sender_id', input.senderId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20)

    if (alreadySentDailyPrayerToday({
        localDate: input.localDate,
        timezoneOffsetMinutes: input.timezoneOffsetMinutes,
        messages: recentMessages || [],
    })) {
        return 'duplicate'
    }

    return 'fallback-ok'
}

async function loadViewerPairing(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    pairingId: string,
): Promise<{ id: string; leader_id: string; learner_id: string | null } | null> {
    const { data: pairing } = await supabase
        .from('pairings')
        .select('id, leader_id, learner_id')
        .eq('id', pairingId)
        .maybeSingle()
    if (!pairing) return null
    if (pairing.leader_id !== userId && pairing.learner_id !== userId) return null
    return pairing
}

async function loadOrCreateTodaysPrayer(input: {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string
    pairingId: string
    partnerId?: string | null
    partnerName?: string | null
    localDate: string
    prayerInput: Omit<DailyPrayerInput, 'dateKey' | 'partnerName'>
    preferSameDay: boolean
}): Promise<EnsureTodaysPrayerResult> {
    const pairingRow = await loadDailyPrayerRow(input.supabase, {
        userId: input.userId,
        pairingId: input.pairingId,
        localDate: input.localDate,
    })
    const sameDayRow = input.preferSameDay && !pairingRow
        ? await loadAnyDailyPrayerForDate(input.supabase, {
            userId: input.userId,
            localDate: input.localDate,
        })
        : null
    const cached = pairingRow || sameDayRow
    const recentBodies = cached
        ? []
        : await loadRecentDailyPrayerBodies(input.supabase, {
            userId: input.userId,
            limit: DAILY_PRAYER_RECENT_LIMIT,
        })

    const resolved = await resolveTodaysPrayer({
        prayerInput: {
            ...input.prayerInput,
            dateKey: input.localDate,
            partnerName: input.partnerName,
        },
        cached: cached ? rowToDailyPrayerContent(cached) : null,
        recentBodies,
        generate: cached ? undefined : generateDailyPrayerDraft,
    })

    if (!cached) {
        const saved = await saveDailyPrayerRow(
            input.supabase,
            dailyPrayerContentToRow({
                userId: input.userId,
                pairingId: input.pairingId,
                partnerId: input.partnerId,
                localDate: input.localDate,
                content: resolved.content,
                generatedBy: resolved.origin === 'ai' ? 'ai' : 'catalog',
            }),
        )
        if (saved === 'duplicate') {
            const winner = await loadDailyPrayerRow(input.supabase, {
                userId: input.userId,
                pairingId: input.pairingId,
                localDate: input.localDate,
            })
            if (winner) {
                return { content: rowToDailyPrayerContent(winner), origin: 'cache' }
            }
        }
    }

    return resolved
}
