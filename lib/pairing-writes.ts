import 'server-only'

import { createAdminClient } from '@/lib/supabase/server'
import { groupAssignments } from '@/lib/assignment-grouping'
import type { Assignment } from '@/lib/types'
import {
  USER_JOURNEY_ON_CONFLICT,
  buildCompletedUserJourneyRow,
  isJourneyCompleteForGraduation,
  resolveJourneyTotalWeeks,
} from '@/lib/journey-graduation'

/**
 * Advance current_week for the pairing the page is actually showing.
 * Admin client: RLS can block a leader from updating another user's pairing.
 */
export async function advancePairingWeek(params: {
  pairingId: string
  expectedPairingId: string
  nextWeek: number
  maxWeek: number
}): Promise<{ updated: boolean; error?: string }> {
  if (!params.pairingId || params.pairingId !== params.expectedPairingId) {
    return { updated: false, error: 'pairing_mismatch' }
  }
  if (params.nextWeek < 1 || params.nextWeek > params.maxWeek) {
    return { updated: false }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pairings')
    .update({ current_week: params.nextWeek })
    .eq('id', params.pairingId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[advancePairingWeek] failed', { pairingId: params.pairingId, error })
    return { updated: false, error: error.message }
  }

  return { updated: !!data }
}

/**
 * When every grouped assignment is done, mark the pairing completed
 * (existing pairings.status value) and upsert user_journeys the same way
 * the admin path does: onConflict user_id,journey_id.
 */
export async function markPairingJourneyCompleted(params: {
  pairingId: string
  expectedPairingId?: string
}): Promise<{ completed: boolean; reason?: string; error?: string }> {
  if (!params.pairingId) {
    return { completed: false, reason: 'missing_pairing' }
  }
  if (params.expectedPairingId && params.expectedPairingId !== params.pairingId) {
    return { completed: false, reason: 'pairing_mismatch' }
  }

  const admin = createAdminClient()

  const { data: pairing, error: pairingError } = await admin
    .from('pairings')
    .select('id, status, current_week, learner_id, journey_id, journey:journeys(total_weeks)')
    .eq('id', params.pairingId)
    .maybeSingle()

  if (pairingError) {
    return { completed: false, error: pairingError.message }
  }
  if (!pairing) {
    return { completed: false, reason: 'missing_pairing' }
  }
  if (pairing.status === 'completed') {
    return { completed: false, reason: 'already_completed' }
  }
  if (pairing.status !== 'active' || !pairing.learner_id) {
    return { completed: false, reason: 'pairing_not_active' }
  }

  const journey = Array.isArray(pairing.journey) ? pairing.journey[0] : pairing.journey
  const totalWeeks = resolveJourneyTotalWeeks(journey)

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
    .eq('pairing_id', pairing.id)
    .eq('user_id', pairing.learner_id)
    .eq('status', 'completed')

  const isComplete = isJourneyCompleteForGraduation({
    currentWeek: pairing.current_week || 1,
    totalWeeks,
    groupedAssignments: grouped,
    completedAssignmentIds: (progress || []).map((row) => row.assignment_id),
  })

  if (!isComplete) {
    return { completed: false, reason: 'not_complete' }
  }

  const completedAt = new Date().toISOString()
  const { error: updateError } = await admin
    .from('pairings')
    .update({
      status: 'completed',
      completed_at: completedAt,
    })
    .eq('id', pairing.id)
    .eq('status', 'active')

  if (updateError) {
    console.error('[markPairingJourneyCompleted] pairing update failed', updateError)
    return { completed: false, error: updateError.message }
  }

  if (pairing.journey_id) {
    const { error: journeyError } = await admin
      .from('user_journeys')
      .upsert(
        buildCompletedUserJourneyRow({
          userId: pairing.learner_id,
          journeyId: pairing.journey_id,
          pairingId: pairing.id,
          completedAt,
        }),
        { onConflict: USER_JOURNEY_ON_CONFLICT },
      )

    if (journeyError) {
      console.error('[markPairingJourneyCompleted] user_journeys upsert failed', journeyError)
      return { completed: true, error: journeyError.message }
    }
  }

  return { completed: true }
}
