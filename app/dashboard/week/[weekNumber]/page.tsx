import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WeekDetailView } from '@/components/week/week-detail-view'
import { getSelectedPairingId } from '@/lib/selected-pairing'

interface WeekPageProps {
  params: Promise<{ weekNumber: string }>
  searchParams: Promise<{ pairing?: string; assignmentId?: string }>
}

export default async function WeekPage({ params, searchParams }: WeekPageProps) {
  const { weekNumber } = await params
  const { pairing: urlPairingId, assignmentId } = await searchParams
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

  // Check if week is accessible
  if (weekNum > pairing.current_week) {
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
  const { data: assignmentProgress } = await supabase
    .from('assignment_progress')
    .select('*')
    .eq('pairing_id', pairing.id)
    .eq('user_id', progressUserId)

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

  // Get journey name for the pairing
  let journeyName: string | undefined
  if (pairing?.journey_id) {
    const { data: journey } = await supabase
      .from('journeys')
      .select('name')
      .eq('id', pairing.journey_id)
      .single()
    journeyName = journey?.name
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
      expandedAssignmentId={assignmentId}
      journeyName={journeyName}
      organizationId={organizationId}
      organizationName={organizationName}
    />
  )
}
