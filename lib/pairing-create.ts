'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { fetchDefaultJourneyId } from '@/lib/default-journey'

function generatePairingInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Create a pending invite pairing for the signed-in leader, always attaching
 * the default journey so Graduate / user_journeys have a journey_id.
 */
export async function createPendingLeaderPairing(): Promise<{
  success?: boolean
  pairingId?: string
  inviteCode?: string
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'leader') {
    return { error: 'Only leaders can create a pairing' }
  }

  const admin = createAdminClient()
  const journeyId = await fetchDefaultJourneyId(admin)
  const inviteCode = generatePairingInviteCode()

  const { data, error } = await admin
    .from('pairings')
    .insert({
      leader_id: user.id,
      invite_code: inviteCode,
      status: 'pending',
      journey_id: journeyId,
    })
    .select('id, invite_code')
    .single()

  if (error || !data) {
    console.error('[createPendingLeaderPairing] insert failed', error)
    return { error: 'Failed to create pairing code' }
  }

  return { success: true, pairingId: data.id, inviteCode: data.invite_code }
}
