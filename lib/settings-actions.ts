'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function removeAvatar() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    // Delete all avatar files for this user
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(user.id)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`)
      await supabase.storage.from('avatars').remove(filesToDelete)
    }

    // Clear avatar URL in profile
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard')
    return { success: true }
  } catch {
    return { error: 'Unable to remove avatar. Please try again.' }
  }
}

export async function deleteAccount() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const admin = createAdminClient()
    const userId = user.id

    // Delete user data from all tables in dependency order
    // (tables referencing user_id or sender_id)
    await admin.from('push_subscriptions').delete().eq('user_id', userId)
    await admin.from('notifications').delete().eq('user_id', userId)
    await admin.from('messages').delete().eq('sender_id', userId)
    await admin.from('assignment_progress').delete().eq('user_id', userId)
    await admin.from('reflections').delete().eq('user_id', userId)

    // Handle pairings: remove user from any pairings they're part of
    // As leader: delete the pairing if no learner, otherwise unset leader
    // As learner: unset the learner_id
    await admin
      .from('pairings')
      .update({ learner_id: null, status: 'pending' })
      .eq('learner_id', userId)

    await admin
      .from('pairings')
      .delete()
      .eq('leader_id', userId)
      .is('learner_id', null)

    await admin
      .from('pairings')
      .update({ leader_id: null, status: 'ended' })
      .eq('leader_id', userId)

    // Delete the profile
    await admin.from('profiles').delete().eq('id', userId)

    // Delete the auth user
    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (authError) {
      return { error: 'Failed to delete account. Please contact support.' }
    }

    // Sign out the current session
    await supabase.auth.signOut()
  } catch {
    return { error: 'Unable to delete account. Please try again.' }
  }

  redirect('/')
}
