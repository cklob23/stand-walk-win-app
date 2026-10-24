'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyNewMessage } from '@/lib/notifications'
import { formatPrayerMessage, retargetPartnerMention } from '@/lib/daily-prayer-content'
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

export async function sendDailyPrayerToPartner(input: {
    pairingId: string
    partnerUserId: string
    prayerBody: string
    scriptureText: string
    scriptureRef: string
    localDate?: string
    timezoneOffsetMinutes?: number
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

    const content = formatPrayerMessage({
        body: retargetPartnerMention(input.prayerBody, recipientName),
        scriptureText: input.scriptureText,
        scriptureRef: input.scriptureRef,
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
