'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
}): Promise<{ success?: boolean; marked?: number; error?: string }> {
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

    // No revalidatePath — this action is invoked from a client effect on
    // /dashboard/messages. Revalidating here (or during RSC render) crashes
    // that route. The caller refreshes the bell via router.refresh().
    return { success: true, marked: data?.length ?? 0 }
}
