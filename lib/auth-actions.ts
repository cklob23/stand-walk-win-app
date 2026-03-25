'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Create admin client that bypasses RLS
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Check if an email is already registered
export async function checkEmailExists(email: string) {
  try {
    const adminSupabase = getAdminClient()

    // Check auth.users for existing email
    const { data, error } = await adminSupabase.auth.admin.listUsers()

    if (error) {
      console.error('Error checking email:', error)
      return { exists: false }
    }

    const existingUser = data.users.find(
      user => user.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      // Get profile to check their role
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', existingUser.id)
        .single()

      return {
        exists: true,
        role: profile?.role || null,
        name: profile?.full_name || null
      }
    }

    return { exists: false }
  } catch (err) {
    console.error('Error checking email existence:', err)
    return { exists: false }
  }
}

// Validate a pairing code for learner signup
export async function validatePairingCode(code: string) {
  try {
    const adminSupabase = getAdminClient()

    // Find the pairing by invite_code
    const { data: pairing, error: pairingError } = await adminSupabase
      .from('pairings')
      .select('*')
      .eq('invite_code', code.toUpperCase())
      .eq('status', 'pending')
      .is('learner_id', null)
      .single()

    if (pairingError || !pairing) {
      return { valid: false, error: 'Invalid or already used pairing code' }
    }

    // Get leader's profile with tier info
    const { data: leader, error: leaderError } = await adminSupabase
      .from('profiles')
      .select('id, full_name, subscription_tier_id, organization_id')
      .eq('id', pairing.leader_id)
      .single()

    if (leaderError || !leader) {
      return { valid: false, error: 'Unable to find leader for this pairing code' }
    }

    // Get tier details
    let tierName: string | null = null
    let maxLearners = 1
    if (leader.subscription_tier_id) {
      const { data: tier } = await adminSupabase
        .from('subscription_tiers')
        .select('name, display_name, max_learners')
        .eq('id', leader.subscription_tier_id)
        .single()

      tierName = tier?.display_name || tier?.name || null
      maxLearners = tier?.max_learners || 1
    }

    // Count current active/pending learners for this leader
    const { count: currentLearners } = await adminSupabase
      .from('pairings')
      .select('*', { count: 'exact', head: true })
      .eq('leader_id', leader.id)
      .not('learner_id', 'is', null)

    if ((currentLearners || 0) >= maxLearners) {
      return { valid: false, error: 'This leader has reached their maximum number of learners' }
    }

    // Get organization name if applicable
    let organizationName: string | null = null
    if (leader.organization_id) {
      const { data: org } = await adminSupabase
        .from('organizations')
        .select('name')
        .eq('id', leader.organization_id)
        .single()

      organizationName = org?.name || null
    }

    // Get the journey_id from the pairing
    const journeyId = pairing.journey_id

    return {
      valid: true,
      pairing: {
        id: pairing.id,
        code: pairing.invite_code,
        leaderId: leader.id,
        leaderName: leader.full_name,
        tierId: leader.subscription_tier_id,
        tierName,
        organizationId: leader.organization_id,
        organizationName,
        journeyId,
        availableSlots: maxLearners - (currentLearners || 0),
      }
    }
  } catch (err) {
    return { valid: false, error: 'Unable to validate code. Please try again.' }
  }
}

// Redeem a pairing code for a learner after signup
export async function redeemPairingCode(userId: string, pairingId: string) {
  try {
    const adminSupabase = getAdminClient()

    // Get the pairing details
    const { data: pairing, error: fetchError } = await adminSupabase
      .from('pairings')
      .select('*, leader:profiles!pairings_leader_id_fkey(subscription_tier_id, organization_id)')
      .eq('id', pairingId)
      .single()

    if (fetchError || !pairing) {
      return { error: 'Pairing not found' }
    }

    // Update the pairing with the learner
    const { error: updateError } = await adminSupabase
      .from('pairings')
      .update({
        learner_id: userId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', pairingId)

    if (updateError) {
      return { error: 'Failed to complete pairing' }
    }

    // Update learner's profile with role, tier and organization from leader
    const profileUpdate: Record<string, unknown> = {
      role: 'learner',
      subscription_tier_id: pairing.leader?.subscription_tier_id,
    }

    if (pairing.leader?.organization_id) {
      profileUpdate.organization_id = pairing.leader.organization_id
    }

    await adminSupabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)

    // Add learner to organization_members if organization exists
    if (pairing.leader?.organization_id) {
      await adminSupabase
        .from('organization_members')
        .upsert({
          organization_id: pairing.leader.organization_id,
          user_id: userId,
          role: 'member',
        }, { onConflict: 'organization_id,user_id' })
    }

    // Add the journey to user_journeys if journey exists
    if (pairing.journey_id) {
      await adminSupabase
        .from('user_journeys')
        .upsert({
          user_id: userId,
          journey_id: pairing.journey_id,
          status: 'active',
        }, { onConflict: 'user_id,journey_id' })
    }

    return { success: true }
  } catch (err) {
    return { error: 'Unable to complete pairing. Please try again.' }
  }
}

// Validate an access code and return its details
export async function validateAccessCode(code: string) {
  try {
    // Use admin client to bypass RLS for lookups
    const adminSupabase = getAdminClient()

    // First get the access code
    const { data: accessCode, error } = await adminSupabase
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'available')
      .is('claimed_by', null)
      .single()

    if (error || !accessCode) {
      return { valid: false, error: 'Invalid or already used access code' }
    }

    // Fetch tier name if tier_id exists
    let tierName: string | null = null
    if (accessCode.tier_id) {
      const { data: tier } = await adminSupabase
        .from('subscription_tiers')
        .select('name, display_name')
        .eq('id', accessCode.tier_id)
        .single()

      tierName = tier?.display_name || tier?.name || null
    }

    // Fetch organization name if organization_id exists
    let organizationName: string | null = null
    if (accessCode.organization_id) {
      const { data: org } = await adminSupabase
        .from('organizations')
        .select('name')
        .eq('id', accessCode.organization_id)
        .single()

      organizationName = org?.name || null
    }

    // Check subscription status if subscription_id exists
    if (accessCode.subscription_id) {
      const { data: subscription } = await adminSupabase
        .from('subscriptions')
        .select('status')
        .eq('id', accessCode.subscription_id)
        .single()

      if (subscription && subscription.status !== 'active') {
        return { valid: false, error: 'This access code is no longer valid' }
      }
    }

    return {
      valid: true,
      accessCode: {
        id: accessCode.id,
        code: accessCode.code,
        tierId: accessCode.tier_id,
        tierName,
        journeyId: accessCode.journey_id,
        organizationId: accessCode.organization_id,
        organizationName,
      }
    }
  } catch (err) {
    return { valid: false, error: 'Unable to validate code. Please try again.' }
  }
}

// Redeem an access code for a user after signup
export async function redeemAccessCode(userId: string, accessCodeId: string) {
  try {
    // Use admin client to bypass RLS for updates
    const adminSupabase = getAdminClient()

    // Get the access code details
    const { data: accessCode, error: fetchError } = await adminSupabase
      .from('access_codes')
      .select('*')
      .eq('id', accessCodeId)
      .single()

    if (fetchError || !accessCode) {
      return { error: 'Access code not found' }
    }

    // Mark the access code as claimed (valid statuses: available, claimed, expired, revoked)
    const { error: updateError } = await adminSupabase
      .from('access_codes')
      .update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        status: 'claimed',
      })
      .eq('id', accessCodeId)

    if (updateError) {
      return { error: 'Failed to redeem access code' }
    }

    // Update user profile with role, tier, access code, and organization
    // Access code users are always leaders
    const profileUpdate: Record<string, unknown> = {
      role: 'leader',
      subscription_tier_id: accessCode.tier_id,
      access_code_id: accessCode.id,
    }

    if (accessCode.organization_id) {
      profileUpdate.organization_id = accessCode.organization_id
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Add user to organization_members if organization exists
    if (accessCode.organization_id) {
      await adminSupabase
        .from('organization_members')
        .upsert({
          organization_id: accessCode.organization_id,
          user_id: userId,
          role: 'member',
        }, { onConflict: 'organization_id,user_id' })
    }

    // Add the journey to user_journeys
    if (accessCode.journey_id) {
      await adminSupabase
        .from('user_journeys')
        .upsert({
          user_id: userId,
          journey_id: accessCode.journey_id,
          status: 'active',
        }, { onConflict: 'user_id,journey_id' })
    }

    return { success: true }
  } catch (err) {
    return { error: 'Unable to redeem access code. Please try again.' }
  }
}

export async function signUp(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    const accessCodeId = formData.get('accessCodeId') as string | null
    const pairingId = formData.get('pairingId') as string | null
    const codeType = formData.get('codeType') as 'access' | 'pairing' | null

    // Check if email already exists before attempting signup
    const emailCheck = await checkEmailExists(email)
    if (emailCheck.exists) {
      const roleText = emailCheck.role === 'leader' ? 'a Leader' : emailCheck.role === 'learner' ? 'a Learner' : 'a user'
      return {
        error: `This email is already registered as ${roleText}. Please sign in instead, or use a different email address.`
      }
    }

    // First, create the user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          access_code_id: accessCodeId,
          pairing_id: pairingId,
          code_type: codeType,
        }
      },
    })

    if (error) {
      return { error: error.message }
    }

    // If email confirmation is required, show verification screen
    if (data.user && !data.session) {
      return {
        success: true,
        requiresVerification: true,
        email,
        password,
        accessCodeId,
        pairingId,
        codeType,
        message: 'We sent a code to your email. Enter it below to verify your account.'
      }
    }

    // If we have a session immediately, redeem the code
    if (data.user) {
      if (codeType === 'pairing' && pairingId) {
        await redeemPairingCode(data.user.id, pairingId)
      } else if (accessCodeId) {
        await redeemAccessCode(data.user.id, accessCodeId)
      }
    }

    revalidatePath('/', 'layout')
    redirect('/onboarding')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    return { error: 'Unable to connect. Please try again.' }
  }
}

export async function verifyOtp(
  email: string,
  token: string,
  password?: string,
  type: 'signup' | 'email' = 'signup',
  accessCodeId?: string,
  pairingId?: string,
  codeType?: 'access' | 'pairing'
) {
  try {
    const supabase = await createClient()

    // Verify the OTP - use 'signup' type for signup verification
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    })

    if (error) {
      return { error: error.message }
    }

    if (data.session && data.user) {
      // Redeem the appropriate code
      if (codeType === 'pairing' && pairingId) {
        await redeemPairingCode(data.user.id, pairingId)
      } else if (accessCodeId) {
        await redeemAccessCode(data.user.id, accessCodeId)
      }
      revalidatePath('/', 'layout')
      return { success: true }
    }

    // If no session from OTP, try signing in with password (for signup flow)
    if (password) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        return { error: signInError.message }
      }

      // Redeem the appropriate code
      if (signInData.user) {
        if (codeType === 'pairing' && pairingId) {
          await redeemPairingCode(signInData.user.id, pairingId)
        } else if (accessCodeId) {
          await redeemAccessCode(signInData.user.id, accessCodeId)
        }
      }

      revalidatePath('/', 'layout')
      return { success: true }
    }

    return { error: 'Verification failed. Please try again.' }
  } catch (err) {
    return { error: 'Unable to verify code. Please try again.' }
  }
}

export async function resendOtp(email: string) {
  try {
    const supabase = await createClient()

    // Use resend with 'signup' type to send a new confirmation code
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true, message: 'A new code has been sent to your email.' }
  } catch (err) {
    return { error: 'Unable to resend code. Please try again.' }
  }
}

export async function signIn(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    // Check if user is an org admin without a role (hasn't signed up as leader/learner)
    if (signInData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, admin_role')
        .eq('id', signInData.user.id)
        .single()

      // If user is an org_admin but has no role, redirect them to signup to complete setup
      if (profile?.admin_role === 'org_admin' && !profile?.role) {
        revalidatePath('/', 'layout')
        redirect('/auth/signup?org_admin=true')
      }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    // Handle network errors gracefully
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err // Re-throw redirect errors
    }
    return { error: 'Unable to connect. Please try again.' }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function getUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function getProfile() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return profile
  } catch {
    return null
  }
}

export async function resetPassword(formData: FormData) {
  try {
    const supabase = await createClient()
    const email = formData.get('email') as string

    // Use OTP for password reset instead of link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      }
    })

    if (error) {
      // If user doesn't exist, show generic message for security
      if (error.message.includes('User not found')) {
        return { success: true, email, message: 'If an account exists with this email, you will receive a 6-digit code.' }
      }
      return { error: error.message }
    }

    return { success: true, email, message: 'We sent a 6-digit code to your email.' }
  } catch {
    return { error: 'Unable to send reset email. Please try again.' }
  }
}

export async function verifyPasswordResetOtp(email: string, token: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return { error: error.message }
    }

    if (data.session) {
      return { success: true }
    }

    return { error: 'Verification failed. Please try again.' }
  } catch {
    return { error: 'Unable to verify code. Please try again.' }
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const supabase = await createClient()
    const password = formData.get('password') as string

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    return { error: 'Unable to update password. Please try again.' }
  }
}

export async function joinPairing(inviteCode: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'You must be logged in to join a pairing.' }
    }

    // Find the pending pairing by invite code
    const { data: pairing, error: findError } = await supabase
      .from('pairings')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('status', 'pending')
      .is('learner_id', null)
      .single()

    if (findError || !pairing) {
      return { error: 'Invalid or already used pairing code.' }
    }

    // Prevent leader from joining their own pairing
    if (pairing.leader_id === user.id) {
      return { error: 'You cannot join your own pairing.' }
    }

    // Update the pairing with the learner
    const { data: updateData, error: updateError } = await supabase
      .from('pairings')
      .update({
        learner_id: user.id,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', pairing.id)
      .select()

    if (updateError) {
      return { error: 'Failed to join pairing. Please try again.' }
    }

    // Check if update actually affected a row (RLS might silently block)
    if (!updateData || updateData.length === 0) {
      return { error: 'Unable to join this pairing. Please try again.' }
    }

    // Get the learner's profile for the notification
    const { data: learnerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const learnerName = learnerProfile?.full_name || 'Your learner'

    // Notify the leader that a learner joined
    try {
      const { notifyLearnerJoined } = await import('@/lib/notifications')
      await notifyLearnerJoined(pairing.leader_id, learnerName, pairing.id)
    } catch (notifyErr) {
      // Don't fail the join if notification fails
    }

    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch (err) {
    return { error: 'Unable to join pairing. Please try again.' }
  }
}

export async function resendPasswordResetOtp(email: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      }
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true, message: 'A new code has been sent to your email.' }
  } catch {
    return { error: 'Unable to resend code. Please try again.' }
  }
}
