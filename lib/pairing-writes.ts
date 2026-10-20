import 'server-only'

import { createAdminClient } from '@/lib/supabase/server'
import { groupAssignments } from '@/lib/assignment-grouping'
import type { Assignment } from '@/lib/types'
import { ensureCompletedMeetingProgress } from '@/lib/meeting-progress'
import {
  USER_JOURNEY_ON_CONFLICT,
  buildCompletedUserJourneyRow,
  isJourneyCompleteForGraduation,
  resolveJourneyTotalWeeks,
} from '@/lib/journey-graduation'
import { fetchDefaultJourneyId } from '@/lib/default-journey'

/**
 * Advance current_week for the pairing the page is actually showing.
 * Admin client: RLS can block a leader from updating another user's pairing.
 */
export async function advancePairingWeek(params: {
  pairingId: string
  expectedPairingId: string | null
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
  expectedPairingId?: string | null
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

  let journeyId = pairing.journey_id as string | null
  if (!journeyId) {
    journeyId = await fetchDefaultJourneyId(admin)
    if (journeyId) {
      await admin.from('pairings').update({ journey_id: journeyId }).eq('id', pairing.id)
    }
  }

  const journey = Array.isArray(pairing.journey) ? pairing.journey[0] : pairing.journey
  const totalWeeks = resolveJourneyTotalWeeks(journey)

  let assignmentQuery = admin
    .from('assignments')
    .select('id, week_number, title, assignment_type, order_index, created_at')
    .lte('week_number', totalWeeks)
  if (journeyId) {
    assignmentQuery = assignmentQuery.eq('journey_id', journeyId)
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

  if (journeyId) {
    const { error: journeyError } = await admin
      .from('user_journeys')
      .upsert(
        buildCompletedUserJourneyRow({
          userId: pairing.learner_id,
          journeyId,
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

/**
 * Persist meeting-assignment progress, week advance, and pairing completion
 * for a pairing the caller just changed (e.g. marked a meeting done).
 * This is an explicit action — not a /dashboard load-time fallback write.
 */
export async function syncPairingProgressAfterExplicitAction(params: {
  callerUserId: string
  pairingId: string
}): Promise<{ wroteMeetingProgress: boolean; advancedWeek: boolean; completed: boolean }> {
  const empty = { wroteMeetingProgress: false, advancedWeek: false, completed: false }
  if (!params.pairingId || !params.callerUserId) return empty

  const admin = createAdminClient()
  const { data: pairing } = await admin
    .from('pairings')
    .select('id, status, current_week, leader_id, learner_id, journey_id, journey:journeys(total_weeks)')
    .eq('id', params.pairingId)
    .maybeSingle()

  if (!pairing?.learner_id || pairing.status !== 'active') return empty

  let journeyId = pairing.journey_id as string | null
  if (!journeyId) {
    journeyId = await fetchDefaultJourneyId(admin)
  }

  const journey = Array.isArray(pairing.journey) ? pairing.journey[0] : pairing.journey
  const totalWeeks = resolveJourneyTotalWeeks(journey)

  let assignmentQuery = admin
    .from('assignments')
    .select('id, week_number, title, assignment_type, order_index, created_at')
    .lte('week_number', totalWeeks)
  if (journeyId) {
    assignmentQuery = assignmentQuery.eq('journey_id', journeyId)
  }
  const { data: assignments } = await assignmentQuery

  const { count: meetingCount } = await admin
    .from('scheduled_meetings')
    .select('*', { count: 'exact', head: true })
    .eq('pairing_id', pairing.id)
    .eq('status', 'completed')

  const { data: existingProgress } = await admin
    .from('assignment_progress')
    .select('assignment_id, status')
    .eq('pairing_id', pairing.id)
    .eq('user_id', pairing.learner_id)

  const { wrote } = await ensureCompletedMeetingProgress({
    callerUserId: params.callerUserId,
    pairing: {
      id: pairing.id,
      leader_id: pairing.leader_id,
      learner_id: pairing.learner_id,
    },
    assignments: (assignments || []) as Assignment[],
    existingProgress: existingProgress || [],
    completedMeetingsCount: meetingCount ?? 0,
    expectedPairingId: pairing.id,
  })

  let progressRows = existingProgress || []
  if (wrote) {
    const { data: refreshed } = await admin
      .from('assignment_progress')
      .select('assignment_id, status')
      .eq('pairing_id', pairing.id)
      .eq('user_id', pairing.learner_id)
    progressRows = refreshed || []
  }

  const currentWeek = pairing.current_week || 1
  const currentWeekGrouped = groupAssignments(
    ((assignments || []) as Assignment[]).filter((a) => a.week_number === currentWeek),
  )
  const currentWeekCompleted = currentWeekGrouped.filter((g) =>
    progressRows.some((p) => p.assignment_id === g.id && p.status === 'completed'),
  ).length

  let advancedWeek = false
  let effectiveWeek = currentWeek
  if (
    currentWeekGrouped.length > 0 &&
    currentWeekCompleted >= currentWeekGrouped.length &&
    currentWeek < totalWeeks
  ) {
    const { updated } = await advancePairingWeek({
      pairingId: pairing.id,
      expectedPairingId: pairing.id,
      nextWeek: currentWeek + 1,
      maxWeek: totalWeeks,
    })
    advancedWeek = updated
    if (updated) effectiveWeek = currentWeek + 1
  }

  const journeyComplete = isJourneyCompleteForGraduation({
    currentWeek: effectiveWeek,
    totalWeeks,
    groupedAssignments: groupAssignments((assignments || []) as Assignment[]),
    completedAssignmentIds: progressRows
      .filter((row) => row.status === 'completed')
      .map((row) => row.assignment_id),
  })

  let completed = false
  if (journeyComplete) {
    const result = await markPairingJourneyCompleted({
      pairingId: pairing.id,
      expectedPairingId: pairing.id,
    })
    completed = result.completed
  }

  return { wroteMeetingProgress: wrote, advancedWeek, completed }
}
