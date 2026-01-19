import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { WeekDetailView } from '@/components/week/week-detail-view'

interface WeekPageProps {
  params: Promise<{ weekNumber: string }>
}

export default async function WeekPage({ params }: WeekPageProps) {
  const { weekNumber } = await params
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
    const { data } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
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
  const { data: assignmentProgress } = await supabase
    .from('assignment_progress')
    .select('*')
    .eq('pairing_id', pairing.id)
    .eq('user_id', user.id)

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

  return (
    <WeekDetailView
      profile={profile}
      pairing={pairing}
      partner={partner}
      weekContent={weekContent}
      assignments={assignments || []}
      assignmentProgress={assignmentProgress || []}
      reflections={reflections || []}
    />
  )
}
