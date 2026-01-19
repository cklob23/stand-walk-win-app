import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CovenantView } from '@/components/covenant/covenant-view'

export default async function CovenantPage() {
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

  // Get pairing
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
      .eq('status', 'active')
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
      .eq('status', 'active')
      .single()
    
    if (data) {
      pairing = data
      partner = data.leader
    }
  }

  if (!pairing) {
    redirect('/dashboard')
  }

  return (
    <CovenantView 
      profile={profile}
      pairing={pairing}
      partner={partner}
    />
  )
}
