'use server'

import { createClient } from '@/lib/supabase/server'

type NotificationType = 'message' | 'assignment' | 'week_complete' | 'encouragement' | 'covenant' | 'pairing'

interface CreateNotificationParams {
  userId: string
  pairingId?: string
  type: NotificationType
  title: string
  message: string
}

export async function createNotification({
  userId,
  pairingId,
  type,
  title,
  message,
}: CreateNotificationParams) {
  const supabase = await createClient()

  console.log('[v0] createNotification called:', { userId, type, title })
  
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

  if (error) {
    console.log('[v0] createNotification ERROR:', error)
    return { error: error.message }
  }

  console.log('[v0] createNotification SUCCESS:', data)
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
  learnerId: string,
  weeklyContent: { week_number: number; title: string }[]
) {
  const supabase = await createClient()
  
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
  await notifyWeekUnlocked(learnerId, pairingId, nextWeek, nextWeekContent.title)
  await notifyWeekUnlocked(leaderId, pairingId, nextWeek, nextWeekContent.title)
  
  return { success: true, newWeek: nextWeek }
}
