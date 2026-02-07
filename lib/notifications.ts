'use server'

import { createAdminClient as createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

// Configure VAPID for Web Push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@gatekeeperio.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

type NotificationType = 'message' | 'assignment' | 'week_complete' | 'encouragement' | 'covenant' | 'pairing'

interface CreateNotificationParams {
  userId: string
  pairingId?: string
  type: NotificationType
  title: string
  message: string
}

function getNotificationUrl(type: NotificationType, pairingId?: string): string {
  if (type === 'message' && pairingId) return `/dashboard/messages/${pairingId}`
  return '/dashboard'
}

async function sendWebPush(userId: string, title: string, body: string, url: string, tag: string) {
  try {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

    const supabase = createClient()

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subscriptions?.length) return

    const payload = JSON.stringify({ title, body, url, tag })

    await Promise.allSettled(
      subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
        } catch (err: unknown) {
          const pushError = err as { statusCode?: number }
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      })
    )
  } catch {
    // Don't let push errors prevent notification creation
  }
}

export async function createNotification({
  userId,
  pairingId,
  type,
  title,
  message,
}: CreateNotificationParams) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      pairing_id: pairingId || null,
      type,
      title,
      message,
      read: false,
    })
    .select()
    .single()

  if (error) {
    console.error('createNotification error:', error)
    return { error: error.message }
  }

  // Send Web Push notification (fire-and-forget, don't block)
  const url = getNotificationUrl(type, pairingId || undefined)
  sendWebPush(userId, title, message, url, `notif-${data?.id}`)

  return { success: true }
}

export async function notifyNewMessage(
  recipientId: string,
  senderName: string,
  pairingId: string,
  messagePreview: string
) {
  return createNotification({
    userId: recipientId,
    pairingId,
    type: 'message',
    title: `New message from ${senderName}`,
    message: messagePreview.length > 100 ? messagePreview.slice(0, 100) + '...' : messagePreview,
  })
}

export async function notifyAssignmentCompleted(
  leaderId: string,
  learnerName: string,
  pairingId: string,
  assignmentTitle: string,
  weekNumber: number
) {
  return createNotification({
    userId: leaderId,
    pairingId,
    type: 'assignment',
    title: `${learnerName} completed an assignment`,
    message: `Week ${weekNumber}: "${assignmentTitle}" has been marked as complete.`,
  })
}

export async function notifyWeekCompleted(
  partnerId: string,
  completedByName: string,
  pairingId: string,
  weekNumber: number,
  weekTitle: string
) {
  return createNotification({
    userId: partnerId,
    pairingId,
    type: 'week_complete',
    title: `Week ${weekNumber} completed!`,
    message: `${completedByName} has completed all assignments for "${weekTitle}".`,
  })
}

export async function notifyCovenantSigned(
  partnerId: string,
  signerName: string,
  pairingId: string
) {
  return createNotification({
    userId: partnerId,
    pairingId,
    type: 'covenant',
    title: `${signerName} signed the covenant`,
    message: 'Your partner has signed the discipleship covenant. Sign yours to begin the journey!',
  })
}

export async function notifyCovenantComplete(
  userId: string,
  partnerName: string,
  pairingId: string
) {
  return createNotification({
    userId,
    pairingId,
    type: 'covenant',
    title: 'Covenant Complete!',
    message: `Both you and ${partnerName} have signed. Your discipleship journey begins now!`,
  })
}

export async function notifyPairingCreated(
  learnerId: string,
  leaderName: string,
  pairingId: string
) {
  return createNotification({
    userId: learnerId,
    pairingId,
    type: 'pairing',
    title: 'You have been paired!',
    message: `${leaderName} has accepted you as their Learner. Sign the covenant to begin your journey.`,
  })
}

export async function notifyLearnerJoined(
  leaderId: string,
  learnerName: string,
  pairingId: string
) {
  return createNotification({
    userId: leaderId,
    pairingId,
    type: 'pairing',
    title: `${learnerName} joined your journey`,
    message: `${learnerName} has used your invite code and is ready to begin. Sign the covenant together to start.`,
  })
}

export async function notifyWeekUnlocked(
  userId: string,
  pairingId: string,
  newWeekNumber: number,
  newWeekTitle: string
) {
  return createNotification({
    userId,
    pairingId,
    type: 'week_complete',
    title: `Week ${newWeekNumber} Unlocked!`,
    message: `Congratulations! You can now begin "${newWeekTitle}".`,
  })
}

export async function advanceToNextWeek(
  pairingId: string,
  currentWeek: number,
  learnerName: string,
  leaderId: string,
  weeklyContent: { week_number: number; title: string }[]
) {
  const supabase = createClient()
  
  const nextWeek = currentWeek + 1
  const nextWeekContent = weeklyContent.find(w => w.week_number === nextWeek)
  
  // Only advance if there's a next week (max 6 weeks)
  if (nextWeek > 6 || !nextWeekContent) {
    // Journey complete!
    return { success: true, journeyComplete: true }
  }
  
  // Update the pairing's current week
  const { error } = await supabase
    .from('pairings')
    .update({ current_week: nextWeek })
    .eq('id', pairingId)
  
  if (error) {
    console.error('Failed to advance week:', error)
    return { error: error.message }
  }
  
  // Notify both parties
  await notifyWeekUnlocked(leaderId, pairingId, nextWeek, nextWeekContent.title)
  await notifyWeekUnlocked(leaderId, pairingId, nextWeek, nextWeekContent.title)
  
  return { success: true, newWeek: nextWeek }
}
