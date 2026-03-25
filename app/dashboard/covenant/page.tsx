import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CovenantView } from '@/components/covenant/covenant-view'
import { getSelectedPairingId } from '@/lib/selected-pairing'

export default async function CovenantPage({
  searchParams,
}: {
  searchParams: Promise<{ pairing?: string }>
}) {
  const params = await searchParams
  // Use URL param first, then fall back to cookie
  const cookiePairingId = await getSelectedPairingId()
  const selectedPairingId = params.pairing || cookiePairingId
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
    // Fetch ALL pairings for multi-learner support (include pending for covenant signing)
    const { data: allPairings } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
      .not('learner_id', 'is', null)
      .order('created_at', { ascending: false })

    if (allPairings && allPairings.length > 0) {
      // Use selected pairing from URL or default to most recent
      const selectedPairing = selectedPairingId
        ? allPairings.find(p => p.id === selectedPairingId)
        : allPairings[0]

      if (selectedPairing) {
        pairing = selectedPairing
        // Handle Supabase join which might return array or object
        const learnerData = selectedPairing.learner
        partner = Array.isArray(learnerData) ? learnerData[0] : learnerData
      }
    }
  } else {
    // For learners, fetch their pairing
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
      .maybeSingle()

    if (data) {
      pairing = data
      // Handle Supabase join which might return array or object
      const leaderData = data.leader
      partner = Array.isArray(leaderData) ? leaderData[0] : leaderData
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
