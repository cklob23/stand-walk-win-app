import 'server-only'

import { createAdminClient } from '@/lib/supabase/server'

export interface MeetingProgressAssignment {
  id: string
  assignment_type: string
  week_number: number
}

export interface MeetingProgressRow {
  assignment_id: string
  status: string
}

export interface MeetingProgressPairing {
  id: string
  leader_id: string
  learner_id: string | null
}

/**
 * Persist completed meeting assignment rows for the learner when enough
 * meetings have been marked done. Uses the admin client so a signed-in
 * leader can write the learner's progress (RLS only allows a user to
 * insert/update their own assignment_progress rows).
 *
 * Idempotent: skips already-completed rows and upserts on the unique
 * (pairing_id, assignment_id, user_id) key.
 */
export async function ensureCompletedMeetingProgress({
  callerUserId,
  pairing,
  assignments,
  existingProgress,
  completedMeetingsCount,
  expectedPairingId,
}: {
  callerUserId: string
  pairing: MeetingProgressPairing
  assignments: MeetingProgressAssignment[]
  existingProgress: MeetingProgressRow[]
  completedMeetingsCount: number
  expectedPairingId?: string | null
}): Promise<{ wrote: boolean }> {
  if (expectedPairingId && expectedPairingId !== pairing.id) {
    console.error(
      '[ensureCompletedMeetingProgress] refused write for a pairing other than the one shown',
      { pairingId: pairing.id, expectedPairingId },
    )
    return { wrote: false }
  }

  if (!pairing.learner_id || completedMeetingsCount <= 0) {
    return { wrote: false }
  }

  const isLeader = callerUserId === pairing.leader_id
  const isLearner = callerUserId === pairing.learner_id
  if (!isLeader && !isLearner) {
    console.error(
      '[ensureCompletedMeetingProgress] caller is not the leader or learner of pairing',
      { pairingId: pairing.id, callerUserId },
    )
    return { wrote: false }
  }

  const meetingAssignments = assignments.filter(
    (assignment) =>
      assignment.assignment_type === 'meeting' &&
      assignment.week_number <= completedMeetingsCount,
  )

  if (meetingAssignments.length === 0) {
    return { wrote: false }
  }

  const admin = createAdminClient()
  let wrote = false

  for (const meetingAssignment of meetingAssignments) {
    const alreadyCompleted = existingProgress.some(
      (progress) =>
        progress.assignment_id === meetingAssignment.id &&
        progress.status === 'completed',
    )
    if (alreadyCompleted) continue

    const { error } = await admin
      .from('assignment_progress')
      .upsert(
        {
          pairing_id: pairing.id,
          assignment_id: meetingAssignment.id,
          user_id: pairing.learner_id,
          status: 'completed',
          notes: 'Meeting completed',
          completed_at: new Date().toISOString(),
        },
        {
          onConflict: 'pairing_id,assignment_id,user_id',
          ignoreDuplicates: false,
        },
      )

    if (error) {
      console.error('[ensureCompletedMeetingProgress] failed to upsert meeting progress', {
        pairingId: pairing.id,
        assignmentId: meetingAssignment.id,
        learnerId: pairing.learner_id,
        error,
      })
      continue
    }

    wrote = true
  }

  return { wrote }
}
