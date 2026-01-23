'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateNotificationSettings(settings: {
  email_notifications?: boolean
  message_notifications?: boolean
  progress_notifications?: boolean
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        email_notifications: settings.email_notifications,
        message_notifications: settings.message_notifications,
        progress_notifications: settings.progress_notifications,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch {
    return { error: 'Unable to update settings. Please try again.' }
  }
}
