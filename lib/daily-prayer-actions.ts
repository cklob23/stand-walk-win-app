'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifyNewMessage } from '@/lib/notifications'
import { formatPrayerMessage } from '@/lib/daily-prayer-content'

export async function sendDailyPrayerToPartner(input: {
    pairingId: string
    partnerUserId: string
    prayerBody: string
    scriptureText: string
    scriptureRef: string
}): Promise<{ success: true } | { error: string }> {
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

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

    const content = formatPrayerMessage({
        body: input.prayerBody,
        scriptureText: input.scriptureText,
        scriptureRef: input.scriptureRef,
    })

    const { error } = await supabase.from('messages').insert({
        pairing_id: pairing.id,
        sender_id: user.id,
        content,
    })

    if (error) return { error: error.message }

    const senderName = profile?.full_name || 'Your partner'
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
