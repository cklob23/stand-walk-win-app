import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderDashboard } from '@/components/dashboard/leader-dashboard'
import { LearnerDashboard } from '@/components/dashboard/learner-dashboard'
import { NoPairingState } from '@/components/dashboard/no-pairing-state'
import { CovenantRequired } from '@/components/dashboard/covenant-required'
import type { Message } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  if (!profile.onboarding_complete) {
    redirect('/onboarding')
  }

  // Get pairing based on role
  let pairing = null
  let partner = null

  if (profile.role === 'leader') {
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      pairing = data
      partner = data.learner
    }
  } else {
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        leader:profiles!pairings_leader_id_fkey(*)
      `)
      .eq('learner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      pairing = data
      partner = data.leader
    }
  }

  // Get weekly content
  const { data: weeklyContent } = await supabase
    .from('weekly_content')
    .select('*')
    .order('week_number', { ascending: true })

  // Get assignments for current week
  const currentWeek = pairing?.current_week || 1
  const { data: assignments } = await supabase
    .from('assignments')
    .select('*')
    .order('week_number', { ascending: true })
    .order('order_index', { ascending: true })

  // Get assignment progress
  let assignmentProgress: { id?: string; assignment_id: string; status: string; notes: string | null; completed_at: string | null }[] = []
  if (pairing) {
    const { data } = await supabase
      .from('assignment_progress')
      .select('*')
      .eq('pairing_id', pairing.id)

    assignmentProgress = data || []
  }

  // Check if current week is complete and auto-advance if needed
  let effectiveCurrentWeek = currentWeek
  if (pairing && assignments && assignments.length > 0) {
    // Get assignments for the current week
    const currentWeekAssignments = (assignments || []).filter(a => a.week_number === currentWeek)

    // Only count progress for assignments in the current week
    const currentWeekAssignmentIds = new Set(currentWeekAssignments.map(a => a.id))
    const currentWeekCompletedCount = assignmentProgress.filter(p =>
      currentWeekAssignmentIds.has(p.assignment_id) && p.status === 'completed'
    ).length

    // If all assignments for current week are complete, advance to next week
    if (currentWeekAssignments.length > 0 && currentWeekCompletedCount >= currentWeekAssignments.length && currentWeek < 6) {
      const nextWeek = currentWeek + 1

      // Update the pairing's current week in the database
      await supabase
        .from('pairings')
        .update({ current_week: nextWeek })
        .eq('id', pairing.id)

      // Update the local value
      effectiveCurrentWeek = nextWeek
      pairing.current_week = nextWeek
    }
  }

  // Get recent messages
  let recentMessages: Message[] = []
  if (pairing) {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(id, full_name, avatar_url),
        reactions:message_reactions(*)
      `)
      .eq('pairing_id', pairing.id)
      .order('created_at', { ascending: false })
      .limit(10)

    recentMessages = (data || []) as Message[]
  }

  // Get next upcoming meeting
  let nextMeeting = null
  if (pairing) {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('scheduled_meetings')
      .select('*')
      .eq('pairing_id', pairing.id)
      .eq('status', 'scheduled')
      .gte('meeting_date', today)
      .order('meeting_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .single()

    nextMeeting = data
  }

  // Get unread notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(5)

  // If no active pairing, show the no pairing state
  if (!pairing || (pairing.status === 'pending' && !pairing.learner_id)) {
    return (
      <NoPairingState
        profile={profile}
        pairingCode={pairing?.invite_code || null}
        pairingId={pairing?.id || null}
      />
    )
  }

  // Check if both parties have signed the covenant
  const covenantComplete = pairing.covenant_accepted_leader && pairing.covenant_accepted_learner

  // If covenant not complete, show covenant required screen
  if (!covenantComplete && pairing.learner_id) {
    return (
      <CovenantRequired
        profile={profile}
        pairing={pairing}
        partner={partner}
      />
    )
  }

  // Check if there's a COMPLETED meeting for the current journey week.
  // Only meetings marked "Done" count — merely scheduled meetings do not.
  // For week N, the learner needs at least N completed meetings total.
  // This ensures each week requires a new completed meeting before advancing.
  let hasWeeklyMeeting = false
  if (pairing) {
    const { count } = await supabase
      .from('scheduled_meetings')
      .select('*', { count: 'exact', head: true })
      .eq('pairing_id', pairing.id)
      .eq('status', 'completed')

    hasWeeklyMeeting = (count ?? 0) >= effectiveCurrentWeek
  }

  // Check if user has journal entry for today
  // Note: this uses UTC date on the server; the DailyJournalPopup also checks
  // via localStorage with the client's local date for accurate dismissal
  let hasJournalEntryToday = false
  if (pairing) {
    const today = new Date().toISOString().split('T')[0]
    const { data: journalEntry } = await supabase
      .from('prayer_journal')
      .select('id')
      .eq('user_id', user.id)
      .eq('journal_date', today)
      .limit(1)

    hasJournalEntryToday = (journalEntry?.length ?? 0) > 0
  }

  // Get shared journal entries for leader view
  let sharedJournalEntries: { id: string; entry_date: string; prayer_items: string; god_saying: string }[] = []
  if (profile.role === 'leader' && pairing && pairing.learner_id) {
    const { data } = await supabase
      .from('prayer_journal')
      .select('id, entry_date, prayer_items, god_saying')
      .eq('pairing_id', pairing.id)
      .eq('user_id', pairing.learner_id)
      .eq('shared_with_leader', true)
      .order('entry_date', { ascending: false })
      .limit(3)

    sharedJournalEntries = data || []
  }

  const dashboardProps = {
    profile,
    pairing,
    partner,
    weeklyContent: weeklyContent || [],
    assignments: assignments || [],
    assignmentProgress,
    recentMessages: recentMessages.reverse(),
    notifications: notifications || [],
    currentWeek: effectiveCurrentWeek,
    nextMeeting,
    hasWeeklyMeeting,
  }

  if (profile.role === 'leader') {
    return <LeaderDashboard {...dashboardProps} sharedJournalEntries={sharedJournalEntries} hasJournalEntryToday={hasJournalEntryToday} />
  }

  return <LearnerDashboard {...dashboardProps} hasJournalEntryToday={hasJournalEntryToday} />
}
