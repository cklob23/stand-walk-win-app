/**
 * Pure helpers for the leader "learner completed the 6-week journey"
 * notification. Keep this file free of Next/Supabase imports so tests can
 * run it with node:test.
 */

export const JOURNEY_COMPLETE_NOTIFICATION_TYPE = 'journey_complete' as const

export const JOURNEY_COMPLETE_TOTAL_WEEKS = 6

export const USER_JOURNEY_ON_CONFLICT = 'user_id,journey_id'

export const WEEK_UNLOCKED_EVENT = 'week_unlocked' as const

export type JourneyGraduationSkipReason =
  | 'missing_pairing'
  | 'missing_relationship'
  | 'pairing_not_active'
  | 'not_complete'
  | 'already_notified'
  | 'self_pairing'

export interface JourneyGraduationPairing {
  id: string
  leader_id: string | null
  learner_id: string | null
  status?: string | null
  current_week?: number | null
}

export interface JourneyCompleteNotificationPayload {
  user_id: string
  pairing_id: string
  type: typeof JOURNEY_COMPLETE_NOTIFICATION_TYPE
  title: string
  message: string
  read: false
  metadata: {
    event: 'journey_complete'
    learnerId: string
    weekNumber: number
  }
}

export type JourneyGraduationDecision =
  | { action: 'insert'; payload: JourneyCompleteNotificationPayload }
  | { action: 'skip'; reason: JourneyGraduationSkipReason }

export function displayLearnerName(fullName: string | null | undefined): string {
  const trimmed = (fullName || '').trim()
  return trimmed || 'A learner'
}

export function buildJourneyCompleteNotification(params: {
  leaderId: string
  pairingId: string
  learnerId: string
  learnerName: string | null | undefined
}): JourneyCompleteNotificationPayload {
  const name = displayLearnerName(params.learnerName)
  return {
    user_id: params.leaderId,
    pairing_id: params.pairingId,
    type: JOURNEY_COMPLETE_NOTIFICATION_TYPE,
    title: `${name} has completed the 6-week journey!`,
    message: `${name} finished every assignment in the 6-week journey.`,
    read: false,
    metadata: {
      event: 'journey_complete',
      learnerId: params.learnerId,
      weekNumber: JOURNEY_COMPLETE_TOTAL_WEEKS,
    },
  }
}

/** Leader dashboard for this pairing. Same query the learner switcher honors. */
export function journeyCompleteHref(pairingId: string): string {
  return `/dashboard?pairing=${encodeURIComponent(pairingId)}`
}

export function resolveJourneyTotalWeeks(
  journey?: { total_weeks?: number | null; duration_weeks?: number | null } | null,
): number {
  const fromJourney = journey?.total_weeks || journey?.duration_weeks
  return fromJourney && fromJourney > 0 ? fromJourney : JOURNEY_COMPLETE_TOTAL_WEEKS
}

export function buildCompletedUserJourneyRow(params: {
  userId: string
  journeyId: string
  pairingId: string
  completedAt?: string
}): {
  user_id: string
  journey_id: string
  pairing_id: string
  status: 'completed'
  completed_at: string
  completion_percentage: 100
} {
  return {
    user_id: params.userId,
    journey_id: params.journeyId,
    pairing_id: params.pairingId,
    status: 'completed',
    completed_at: params.completedAt ?? new Date().toISOString(),
    completion_percentage: 100,
  }
}

/** One leader + one learner. A self-pairing is notified once. */
export function weekUnlockRecipientIds(
  leaderId: string | null | undefined,
  learnerId: string | null | undefined,
): string[] {
  const ids: string[] = []
  if (leaderId) ids.push(leaderId)
  if (learnerId && learnerId !== leaderId) ids.push(learnerId)
  return ids
}

export function buildWeekUnlockedMetadata(weekNumber: number): {
  event: typeof WEEK_UNLOCKED_EVENT
  weekNumber: number
} {
  return {
    event: WEEK_UNLOCKED_EVENT,
    weekNumber,
  }
}

export function isJourneyCompleteForGraduation(params: {
  currentWeek: number
  totalWeeks?: number
  groupedAssignments: { id: string; week_number: number }[]
  completedAssignmentIds: Iterable<string>
}): boolean {
  const totalWeeks = params.totalWeeks ?? JOURNEY_COMPLETE_TOTAL_WEEKS
  if (params.currentWeek < totalWeeks) return false
  if (params.groupedAssignments.length === 0) return false
  const completed = new Set(params.completedAssignmentIds)
  return params.groupedAssignments.every((assignment) => completed.has(assignment.id))
}

export function decideJourneyGraduationNotification(input: {
  pairing: JourneyGraduationPairing | null
  learnerName: string | null | undefined
  isJourneyComplete: boolean
  alreadyNotified: boolean
}): JourneyGraduationDecision {
  if (!input.pairing) {
    return { action: 'skip', reason: 'missing_pairing' }
  }

  const leaderId = input.pairing.leader_id
  const learnerId = input.pairing.learner_id
  if (!leaderId || !learnerId) {
    return { action: 'skip', reason: 'missing_relationship' }
  }
  if (leaderId === learnerId) {
    return { action: 'skip', reason: 'self_pairing' }
  }

  const status = input.pairing.status || 'active'
  // Active or already-completed is fine: we may mark the pairing completed
  // in the same request as the notification. Pending/cancelled never notify.
  if (status !== 'active' && status !== 'completed') {
    return { action: 'skip', reason: 'pairing_not_active' }
  }

  if (input.alreadyNotified) {
    return { action: 'skip', reason: 'already_notified' }
  }

  if (!input.isJourneyComplete) {
    return { action: 'skip', reason: 'not_complete' }
  }

  return {
    action: 'insert',
    payload: buildJourneyCompleteNotification({
      leaderId,
      pairingId: input.pairing.id,
      learnerId,
      learnerName: input.learnerName,
    }),
  }
}

export function isPostgresUniqueViolation(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === '23505'
}
