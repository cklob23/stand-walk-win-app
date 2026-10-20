'use server'

import { createAdminClient as createClient } from '@/lib/supabase/server'
import { groupAssignments } from '@/lib/assignment-grouping'
import { unwrapJoinedProfile } from '@/lib/pairing-resolution'
import type { Assignment } from '@/lib/types'
import {
  JOURNEY_COMPLETE_NOTIFICATION_TYPE,
  buildWeekUnlockedMetadata,
  decideJourneyGraduationNotification,
  isJourneyCompleteForGraduation,
  isPostgresUniqueViolation,
  journeyCompleteHref,
  resolveJourneyTotalWeeks,
  weekUnlockRecipientIds,
} from '@/lib/journey-graduation'
import { markPairingJourneyCompleted } from '@/lib/pairing-writes'

// Lazy-initialize web-push to avoid build-time module evaluation errors
let _webpush: typeof import('web-push') | null = null

async function getWebPush() {
  if (!_webpush) {
    const mod = await import('web-push')
    _webpush = mod.default || mod
    try {
      if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        _webpush!.setVapidDetails(
          'mailto:support@gatekeeperio.com',
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        )
      }
    } catch {
      // VAPID setup may fail in edge/browser environments — ignore
    }
  }
  return _webpush!
}

type NotificationType = 'message' | 'assignment' | 'assignment_reply' | 'assignment_reaction' | 'week_complete' | 'encouragement' | 'covenant' | 'pairing' | 'journal_shared' | 'meeting_request' | 'meeting_accepted' | 'meeting_declined' | 'meeting_counter_proposed' | 'meeting_completed' | 'journey_complete'

interface CreateNotificationParams {
  userId: string
  pairingId?: string
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, string | number | boolean | null>
}

function getNotificationUrl(type: NotificationType, pairingId?: string): string {
  if (type === 'journey_complete' && pairingId) return journeyCompleteHref(pairingId)
  if (type === 'message' && pairingId) return `/dashboard/messages/${pairingId}`
  if (type === 'journal_shared') return '/dashboard/journal?section=shared'
  if (type === 'pairing') return '/dashboard/schedule'
  if (type === 'covenant') return '/dashboard/covenant'
  if (type === 'meeting_request' || type === 'meeting_accepted' || type === 'meeting_declined' || type === 'meeting_counter_proposed' || type === 'meeting_completed') return '/dashboard/schedule'
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
    const wp = await getWebPush()

    await Promise.allSettled(
      subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await wp.sendNotification(
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
  metadata,
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
      metadata: metadata || null,
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
  weekNumber: number,
  assignmentId?: string
) {
  return createNotification({
    userId: leaderId,
    pairingId,
    type: 'assignment',
    title: `${learnerName} completed an assignment`,
    message: `Week ${weekNumber}: "${assignmentTitle}" has been marked as complete.`,
    metadata: assignmentId ? { assignmentId, weekNumber } : undefined,
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
  if (!userId || !pairingId) {
    return { error: 'Missing user or pairing' }
  }

  const supabase = createClient()
  const metadata = buildWeekUnlockedMetadata(newWeekNumber)

  const { data: existing, error: existingError } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('pairing_id', pairingId)
    .eq('type', 'week_complete')
    .contains('metadata', metadata)
    .limit(1)

  if (existingError) {
    console.error('notifyWeekUnlocked existing lookup failed:', existingError)
    return { error: existingError.message }
  }

  if ((existing?.length ?? 0) > 0) {
    return { success: true, created: false }
  }

  return createNotification({
    userId,
    pairingId,
    type: 'week_complete',
    title: `Week ${newWeekNumber} Unlocked!`,
    message: `Congratulations! You can now begin "${newWeekTitle}".`,
    metadata,
  })
}

export async function notifySharedVerse(
  recipientId: string,
  senderName: string,
  pairingId: string,
  scriptureRef: string,
  hasNote: boolean
) {
  return createNotification({
    userId: recipientId,
    pairingId,
    type: 'journal_shared',
    title: hasNote ? 'Bible Note Shared' : `${senderName} shared a verse with you`,
    message: hasNote
      ? `${senderName} shared ${scriptureRef} with a note.`
      : `${senderName} shared ${scriptureRef} with you.`,
  })
}

const emojiLabels: Record<string, string> = {
  thumbsup: 'a thumbs up',
  heart: 'a heart',
  pray: 'a prayer',
  laugh: 'a laugh',
  sad: 'a sad face',
  exclamation: 'an exclamation',
}

export async function notifyMessageReaction(
  recipientId: string,
  senderName: string,
  pairingId: string,
  emoji: string,
  messagePreview: string
) {
  const label = emojiLabels[emoji] || `a ${emoji}`
  return createNotification({
    userId: recipientId,
    pairingId,
    type: 'message',
    title: `${senderName} reacted to your message`,
    message: `${senderName} reacted with ${label} to "${messagePreview.length > 60 ? messagePreview.slice(0, 60) + '...' : messagePreview}"`,
  })
}

export async function notifyJournalReaction(
  recipientId: string,
  senderName: string,
  pairingId: string,
  emoji: string
) {
  const label = emojiLabels[emoji] || `a ${emoji}`
  return createNotification({
    userId: recipientId,
    pairingId,
    type: 'journal_shared',
    title: `${senderName} reacted to your journal`,
    message: `${senderName} reacted with ${label} to your shared journal entry.`,
  })
}

export async function notifyJournalReply(
  recipientId: string,
  senderName: string,
  pairingId: string,
  replyPreview: string
) {
  return createNotification({
    userId: recipientId,
    pairingId,
    type: 'journal_shared',
    title: `${senderName} replied to your journal`,
    message: replyPreview.length > 100 ? replyPreview.slice(0, 100) + '...' : replyPreview,
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

  const currentWeekContent = weeklyContent.find(w => w.week_number === currentWeek)
  const nextWeek = currentWeek + 1
  const nextWeekContent = weeklyContent.find(w => w.week_number === nextWeek)

  const { data: pairingRow } = await supabase
    .from('pairings')
    .select('id, leader_id, learner_id, current_week, journey_id, journey:journeys(total_weeks)')
    .eq('id', pairingId)
    .maybeSingle()

  const journey = Array.isArray(pairingRow?.journey) ? pairingRow.journey[0] : pairingRow?.journey
  const totalWeeks = resolveJourneyTotalWeeks(journey)

  // Only advance if there's a next week
  if (nextWeek > totalWeeks || !nextWeekContent) {
    await notifyLeaderOfJourneyComplete(pairingId)
    await markPairingJourneyCompleted({ pairingId, expectedPairingId: pairingId })
    return {
      success: true,
      journeyComplete: true,
      completedWeek: currentWeek,
      completedWeekTitle: currentWeekContent?.title || `Week ${currentWeek}`,
    }
  }

  // Update the pairing's current week
  const { error } = await supabase
    .from('pairings')
    .update({ current_week: nextWeek })
    .eq('id', pairingId)
    .eq('status', 'active')

  if (error) {
    console.error('Failed to advance week:', error)
    return { error: error.message }
  }

  const recipients = weekUnlockRecipientIds(
    pairingRow?.leader_id || leaderId,
    pairingRow?.learner_id,
  )

  for (const userId of recipients) {
    await notifyWeekUnlocked(userId, pairingId, nextWeek, nextWeekContent.title)
  }

  // Return celebration info for the completed week
  return {
    success: true,
    newWeek: nextWeek,
    completedWeek: currentWeek,
    completedWeekTitle: currentWeekContent?.title || `Week ${currentWeek}`,
  }
}

/**
 * Notify the leader that this pairing's learner finished the 6-week journey.
 * Admin client, relationship verified from the pairing row, check-before-insert
 * plus unique index (scripts/011) so it fires at most once per pairing.
 */
export async function notifyLeaderOfJourneyComplete(pairingId: string): Promise<{
  created: boolean
  reason?: string
  error?: string
}> {
  if (!pairingId) {
    return { created: false, reason: 'missing_pairing' }
  }

  try {
    const admin = createClient()

    const { data: pairing, error: pairingError } = await admin
      .from('pairings')
      .select(`
        id,
        leader_id,
        learner_id,
        status,
        current_week,
        journey_id,
        journey:journeys(total_weeks),
        learner:profiles!pairings_learner_id_fkey(id, full_name)
      `)
      .eq('id', pairingId)
      .maybeSingle()

    if (pairingError) {
      console.error('[notifyLeaderOfJourneyComplete] pairing lookup failed', pairingError)
      return { created: false, error: pairingError.message }
    }

    const { data: existing, error: existingError } = await admin
      .from('notifications')
      .select('id')
      .eq('type', JOURNEY_COMPLETE_NOTIFICATION_TYPE)
      .eq('pairing_id', pairingId)
      .limit(1)

    if (existingError) {
      console.error('[notifyLeaderOfJourneyComplete] existing lookup failed', existingError)
      return { created: false, error: existingError.message }
    }

    const alreadyNotified = (existing?.length ?? 0) > 0
    if (alreadyNotified) {
      return { created: false, reason: 'already_notified' }
    }

    const journey = Array.isArray(pairing?.journey) ? pairing.journey[0] : pairing?.journey
    const totalWeeks = resolveJourneyTotalWeeks(journey)

    let isComplete = false
    if (pairing?.learner_id && (pairing.current_week || 1) >= totalWeeks) {
      let assignmentQuery = admin
        .from('assignments')
        .select('id, week_number, title, assignment_type, order_index, created_at')
        .lte('week_number', totalWeeks)

      if (pairing.journey_id) {
        assignmentQuery = assignmentQuery.eq('journey_id', pairing.journey_id)
      }

      const { data: assignments } = await assignmentQuery
      const grouped = groupAssignments((assignments || []) as Assignment[])

      const { data: progress } = await admin
        .from('assignment_progress')
        .select('assignment_id')
        .eq('pairing_id', pairingId)
        .eq('user_id', pairing.learner_id)
        .eq('status', 'completed')

      isComplete = isJourneyCompleteForGraduation({
        currentWeek: pairing.current_week || 1,
        totalWeeks,
        groupedAssignments: grouped,
        completedAssignmentIds: (progress || []).map((row) => row.assignment_id),
      })
    }

    const learner = unwrapJoinedProfile(pairing?.learner as { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null)
    const decision = decideJourneyGraduationNotification({
      pairing: pairing
        ? {
            id: pairing.id,
            leader_id: pairing.leader_id,
            learner_id: pairing.learner_id,
            status: pairing.status,
            current_week: pairing.current_week,
          }
        : null,
      learnerName: learner?.full_name,
      isJourneyComplete: isComplete,
      alreadyNotified,
    })

    if (decision.action === 'skip') {
      return { created: false, reason: decision.reason }
    }

    const { error } = await admin
      .from('notifications')
      .insert(decision.payload)

    if (error) {
      if (isPostgresUniqueViolation(error)) {
        return { created: false, reason: 'already_notified' }
      }
      console.error('[notifyLeaderOfJourneyComplete] insert failed', error)
      return { created: false, error: error.message }
    }

    sendWebPush(
      decision.payload.user_id,
      decision.payload.title,
      decision.payload.message,
      journeyCompleteHref(pairingId),
      `journey-complete-${pairingId}`,
    )

    return { created: true }
  } catch (error) {
    console.error('[notifyLeaderOfJourneyComplete] unexpected error', error)
    return {
      created: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    }
  }
}
