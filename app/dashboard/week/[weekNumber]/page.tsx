import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WeekDetailView } from '@/components/week/week-detail-view'
import { getSelectedPairingId } from '@/lib/selected-pairing'
import { groupAssignments } from '@/lib/assignment-grouping'
import type { Assignment } from '@/lib/types'

interface WeekPageProps {
  params: Promise<{ weekNumber: string }>
  searchParams: Promise<{ pairing?: string; assignmentId?: string; assignment?: string }>
}

export default async function WeekPage({ params, searchParams }: WeekPageProps) {
  const { weekNumber } = await params
  const { pairing: urlPairingId, assignmentId, assignment } = await searchParams
  // Support both ?assignmentId= and ?assignment= query params
  const expandedAssignment = assignmentId || assignment
  // Use URL param first, then fall back to cookie
  const cookiePairingId = await getSelectedPairingId()
  const selectedPairingId = urlPairingId || cookiePairingId
  const weekNum = parseInt(weekNumber, 10)

  if (isNaN(weekNum) || weekNum < 1 || weekNum > 6) {
    notFound()
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Get pairing and partner
  let pairing = null
  let partner = null

  if (profile.role === 'leader') {
    // Fetch ALL pairings for multi-learner support
    const { data: allPairings } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })

    if (allPairings && allPairings.length > 0) {
      // Use selected pairing from URL or default to most recent
      const selectedPairing = selectedPairingId
        ? allPairings.find(p => p.id === selectedPairingId)
        : allPairings[0]

      if (selectedPairing) {
        pairing = selectedPairing
        partner = selectedPairing.learner
      }
    }
  } else {
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        leader:profiles!pairings_leader_id_fkey(*)
      `)
      .eq('learner_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      pairing = data
      partner = data.leader
    }
  }

  if (!pairing) {
    redirect('/dashboard')
  }

  // Check if week is accessible.
  // Leaders can view every week of the journey (to prepare ahead) regardless of
  // the learner's current progress. Learners remain gated by their current week.
  const isLeader = profile.role === 'leader'
  if (!isLeader && weekNum > pairing.current_week) {
    redirect('/dashboard')
  }

  // Get weekly content
  const { data: weekContent } = await supabase
    .from('weekly_content')
    .select('*')
    .eq('week_number', weekNum)
    .single()

  if (!weekContent) {
    notFound()
  }

  // Get assignments for this week
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*')
    .eq('week_number', weekNum)
    .order('order_index', { ascending: true })

  // Get assignment progress
  // For leaders viewing learner dashboard, fetch LEARNER's progress (not leader's)
  // For learners, fetch their own progress
  const progressUserId = profile.role === 'leader' ? pairing.learner_id : user.id
  let { data: assignmentProgress } = await supabase
    .from('assignment_progress')
    .select('*')
    .eq('pairing_id', pairing.id)
    .eq('user_id', progressUserId)

  // Auto-complete meeting assignment when meeting is completed
  // This MUST happen before other progress calculations
  if (assignments && pairing.learner_id) {
    const { count: meetingCount } = await supabase
      .from('scheduled_meetings')
      .select('*', { count: 'exact', head: true })
      .eq('pairing_id', pairing.id)
      .eq('status', 'completed')

    const completedMeetingsCount = meetingCount ?? 0

    // Check if this week's meeting should be auto-completed
    if (completedMeetingsCount >= weekNum) {
      const meetingAssignment = assignments.find((a: { assignment_type: string }) => a.assignment_type === 'meeting')
      if (meetingAssignment) {
        const existingProgress = assignmentProgress?.find(
          p => p.assignment_id === meetingAssignment.id && p.status === 'completed'
        )

        if (!existingProgress) {
          await supabase
            .from('assignment_progress')
            .upsert({
              pairing_id: pairing.id,
              assignment_id: meetingAssignment.id,
              user_id: pairing.learner_id,
              status: 'completed',
              notes: 'Meeting completed',
              completed_at: new Date().toISOString(),
            }, {
              onConflict: 'pairing_id,assignment_id,user_id',
              ignoreDuplicates: false
            })

          // Refetch assignment progress
          const { data: refreshedProgress } = await supabase
            .from('assignment_progress')
            .select('*')
            .eq('pairing_id', pairing.id)
            .eq('user_id', progressUserId)

          assignmentProgress = refreshedProgress
        }
      }
    }
  }

  // If user is a leader, learnerProgress is the same as assignmentProgress
  // (we're already fetching the learner's progress)
  let learnerProgress: typeof assignmentProgress = null
  if (profile.role === 'leader' && pairing.learner_id) {
    learnerProgress = assignmentProgress
  }

  // Fetch assignment reactions (for both leaders and learners viewing feedback)
  // Use admin client to bypass RLS since the RLS policy might be causing issues
  let assignmentReactions: { id: string; assignment_progress_id: string; user_id: string; emoji: string; created_at: string }[] = []
  if (assignmentProgress && assignmentProgress.length > 0) {
    const progressIds = assignmentProgress.filter(p => p.id).map(p => p.id)
    if (progressIds.length > 0) {
      const adminSupabase = createAdminClient()
      const { data: reactions } = await adminSupabase
        .from('assignment_reactions')
        .select('*')
        .in('assignment_progress_id', progressIds)
      assignmentReactions = reactions || []
    }
  }

  // Get reflections for this week
  const { data: reflections } = await supabase
    .from('reflections')
    .select(`
      *,
      user:profiles!reflections_user_id_fkey(id, full_name, avatar_url)
    `)
    .eq('pairing_id', pairing.id)
    .eq('week_number', weekNum)
    .order('created_at', { ascending: false })

  // Get journey name and description for the pairing
  let journeyName: string | undefined
  let journeySubtitle: string | undefined
  if (pairing?.journey_id) {
    const { data: journey } = await supabase
      .from('journeys')
      .select('name, description')
      .eq('id', pairing.journey_id)
      .single()
    journeyName = journey?.name
    journeySubtitle = journey?.description || undefined
  }

  // Get organization info for the user
  let organizationId: string | null = null
  let organizationName: string | null = null
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', profile.organization_id)
      .single()
    if (org) {
      organizationId = org.id
      organizationName = org.name
    }
  }

  // Check if meeting is completed for this journey week.
  // Only meetings marked "Done" count — merely scheduled meetings do not.
  // For week N, the learner needs at least N completed meetings total.
  let hasWeeklyMeeting = false
  if (weekNum === pairing.current_week) {
    const { count } = await supabase
      .from('scheduled_meetings')
      .select('*', { count: 'exact', head: true })
      .eq('pairing_id', pairing.id)
      .eq('status', 'completed')

    hasWeeklyMeeting = (count ?? 0) >= weekNum
  }

  // Check for pending week celebration (learners only)
  let celebrationWeek: number | null = null
  let celebrationWeekTitle: string | null = null

  if (profile.role === 'learner') {
    const currentWeek = pairing.current_week || 1
    const lastCelebratedWeek = pairing.last_celebrated_week || 0

    // If there's an uncelebrated week (weeks 1-5 only)
    if (currentWeek > lastCelebratedWeek + 1 && currentWeek <= 6) {
      const weekToCheck = currentWeek - 1

      // Get assignments for this week
      const { data: weekAssignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('week_number', weekToCheck)

      if (weekAssignments && weekAssignments.length > 0) {
        const grouped = groupAssignments(weekAssignments as Assignment[])
        const primaryIds = grouped.map(g => g.id)

        const { data: completedProgress } = await supabase
          .from('assignment_progress')
          .select('assignment_id')
          .eq('pairing_id', pairing.id)
          .eq('status', 'completed')
          .in('assignment_id', primaryIds)

        if ((completedProgress?.length || 0) >= grouped.length) {
          celebrationWeek = weekToCheck
          // Get week title
          const { data: celebrationWeekContent } = await supabase
            .from('weekly_content')
            .select('title')
            .eq('week_number', weekToCheck)
            .single()
          celebrationWeekTitle = celebrationWeekContent?.title || `Week ${weekToCheck}`
        }
      }
    }
  }

  return (
    <WeekDetailView
      profile={profile}
      pairing={pairing}
      partner={partner}
      weekContent={weekContent}
      assignments={assignments || []}
      assignmentProgress={assignmentProgress || []}
      learnerProgress={learnerProgress || []}
      assignmentReactions={assignmentReactions}
      reflections={reflections || []}
      hasWeeklyMeeting={hasWeeklyMeeting}
      bibleTranslation={profile.bible_translation_preference || 'ESV'}
      bibleTextSize={profile.bible_text_size || 'base'}
      expandedAssignmentId={expandedAssignment}
      journeyName={journeyName}
      journeySubtitle={journeySubtitle}
      organizationId={organizationId}
      organizationName={organizationName}
      celebrationWeek={celebrationWeek}
      celebrationWeekTitle={celebrationWeekTitle}
    />
  )
}
