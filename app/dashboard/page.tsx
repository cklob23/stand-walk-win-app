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
        sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
      `)
      .eq('pairing_id', pairing.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    recentMessages = (data || []) as Message[]
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
        pairingCode={pairing?.invite_code}
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
  }

  if (profile.role === 'leader') {
    return <LeaderDashboard {...dashboardProps} />
  }

  return <LearnerDashboard {...dashboardProps} />
}
