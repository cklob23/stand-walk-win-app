'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { tallyUnreadByPairing } from '@/lib/notification-unread'

export async function markNotificationRead(notificationId: string): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

    if (error) return { error: error.message }
    return { success: true }
}

export async function markAllNotificationsRead(): Promise<{ success?: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

    if (error) return { error: error.message }
    revalidatePath('/dashboard')
    return { success: true }
}

/**
 * Mark notifications as read when the user actually opens the related surface
 * (e.g. viewing a message thread). Optionally scoped to a pairing and type.
 */
export async function markNotificationsReadForContext(options: {
    pairingId?: string | null
    types?: string[]
}): Promise<{
    success?: boolean
    marked?: number
    unreadRemaining?: number
    unreadByPairing?: Record<string, number>
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

    if (options.pairingId) {
        query = query.eq('pairing_id', options.pairingId)
    }
    if (options.types && options.types.length > 0) {
        query = query.in('type', options.types)
    }

    const { data, error } = await query.select('id')
    if (error) return { error: error.message }

    // Same row set the layout uses for the bell and the learner pills.
    // Do not use a separate HEAD count — it can return null/0 while SELECT
    // still finds unread rows (the 2-vs-1 / stale-pill bug).
    const { data: remaining } = await supabase
        .from('notifications')
        .select('id, pairing_id, type')
        .eq('user_id', user.id)
        .eq('read', false)

    // No revalidatePath — this action is invoked from a client effect on
    // /dashboard/messages. Revalidating here (or during RSC render) crashes
    // that route. The caller applies remaining + unreadByPairing immediately.
    return {
        success: true,
        marked: data?.length ?? 0,
        unreadRemaining: remaining?.length ?? 0,
        unreadByPairing: tallyUnreadByPairing(remaining),
    }
}
