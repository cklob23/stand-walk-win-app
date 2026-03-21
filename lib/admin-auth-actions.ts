'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Admin sign in - only allows users who are org admins or master admins
export async function adminSignIn(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'Email and password are required' }
    }

    const supabase = await createClient()

    // First, try to sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (authError) {
        console.error('[v0] Admin sign-in auth error:', authError.message, authError.status, authError.code)
        // Check if email not confirmed
        if (authError.message?.includes('Email not confirmed')) {
            return { error: 'Please confirm your email before signing in. Check your inbox for the confirmation link.' }
        }
        return { error: 'Invalid email or password' }
    }

    if (!authData.user) {
        return { error: 'Unable to sign in' }
    }

    // Check if user is an org admin (owns an organization) or master admin
    const adminClient = createAdminClient()

    // Check for master admin role (use admin_role column, not role)
    const { data: profile } = await adminClient
        .from('profiles')
        .select('admin_role, is_admin, organization_id')
        .eq('id', authData.user.id)
        .single()

    console.log('[v0] Admin sign-in - profile:', profile)

    if (profile?.admin_role === 'master_admin') {
        redirect('/admin/dashboard')
    }

    // Check if they own an organization
    const { data: org } = await adminClient
        .from('organizations')
        .select('id')
        .eq('owner_id', authData.user.id)
        .single()

    console.log('[v0] Admin sign-in - owned org:', org)

    if (org) {
        // Update profile with organization_id if not set
        if (!profile?.organization_id) {
            await adminClient
                .from('profiles')
                .update({ organization_id: org.id })
                .eq('id', authData.user.id)
        }
        redirect('/admin/dashboard')
    }

    // Check if their email matches an organization's admin_email
    const { data: orgByEmail } = await adminClient
        .from('organizations')
        .select('id')
        .eq('admin_email', email)
        .single()

    console.log('[v0] Admin sign-in - org by email:', orgByEmail)

    if (orgByEmail) {
        // Link this user as the owner and update their profile
        await adminClient
            .from('organizations')
            .update({ owner_id: authData.user.id })
            .eq('id', orgByEmail.id)

        await adminClient
            .from('profiles')
            .update({ organization_id: orgByEmail.id })
            .eq('id', authData.user.id)

        redirect('/admin/dashboard')
    }

    // Check if they have any subscription where they are the purchaser
    const { data: subscription } = await adminClient
        .from('subscriptions')
        .select('id, organization_id')
        .eq('purchaser_email', email)
        .single()

    console.log('[v0] Admin sign-in - subscription:', subscription)

    if (subscription) {
        if (subscription.organization_id) {
            // Link user as org owner if not already set
            await adminClient
                .from('organizations')
                .update({ owner_id: authData.user.id })
                .eq('id', subscription.organization_id)
                .is('owner_id', null)

            // Update profile with organization_id
            await adminClient
                .from('profiles')
                .update({ organization_id: subscription.organization_id })
                .eq('id', authData.user.id)
        }
        redirect('/admin/dashboard')
    }

    // Sign out if not an admin
    await supabase.auth.signOut()
    return { error: 'You do not have admin access. Please purchase a subscription to manage an organization.' }
}

// Admin sign up - create account and link to organization via email matching
export async function adminSignUp(formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!name || !email || !password) {
        return { error: 'All fields are required' }
    }

    if (password.length < 8) {
        return { error: 'Password must be at least 8 characters' }
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Check if there's a subscription with this purchaser email
    const { data: subscription } = await adminClient
        .from('subscriptions')
        .select('id, organization_id, purchaser_email')
        .eq('purchaser_email', email)
        .single()

    // Also check if there's an organization with this admin_email
    const { data: orgByEmail } = await adminClient
        .from('organizations')
        .select('id')
        .eq('admin_email', email)
        .single()

    if (!subscription && !orgByEmail) {
        return {
            error: 'No subscription found for this email. Please use the same email you used to purchase your subscription.'
        }
    }

    // Create the user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                is_admin: true,
            },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://standwalkrun.com'}/admin/dashboard`,
        },
    })

    if (authError) {
        if (authError.message.includes('already registered')) {
            return { error: 'An account with this email already exists. Please sign in instead.' }
        }
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: 'Failed to create account' }
    }

    // Wait for Supabase to propagate the user to auth.users table
    // This is needed because profiles has a foreign key to auth.users
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Update admin profile - use admin_role column (not role which is for journey participants)
    // role column has CHECK constraint allowing only 'learner' or 'leader'
    // Use update instead of upsert since Supabase trigger creates the profile
    let profileError = null
    for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await adminClient
            .from('profiles')
            .update({
                full_name: name,
                admin_role: 'org_admin',  // Separate from journey role
                is_admin: true,
            })
            .eq('id', authData.user.id)

        if (!error) {
            profileError = null
            break
        }

        profileError = error
        // If profile doesn't exist yet, wait and retry
        if (error.code === 'PGRST116') {
            await new Promise(resolve => setTimeout(resolve, 500))
        } else {
            break
        }
    }

    if (profileError) {
        console.error('Error updating profile:', profileError)
    }

    // Link to organization via subscription or admin_email
    let linkedOrgId: string | null = null

    if (subscription?.organization_id) {
        linkedOrgId = subscription.organization_id
        await adminClient
            .from('organizations')
            .update({ owner_id: authData.user.id })
            .eq('id', subscription.organization_id)
            .is('owner_id', null)
    } else if (orgByEmail) {
        // Link via admin_email match
        linkedOrgId = orgByEmail.id
        await adminClient
            .from('organizations')
            .update({ owner_id: authData.user.id })
            .eq('id', orgByEmail.id)
            .is('owner_id', null)
    }

    // Update profile with organization_id
    if (linkedOrgId) {
        await adminClient
            .from('profiles')
            .update({ organization_id: linkedOrgId })
            .eq('id', authData.user.id)
        console.log('[v0] Admin signup - linked org:', linkedOrgId)
    }

    // Return needsVerification to trigger OTP input
    return {
        needsVerification: true,
        message: 'Check your email for a verification code.'
    }
}

// Verify OTP code after signup
export async function adminVerifyOTP(formData: FormData) {
    const email = formData.get('email') as string
    const token = formData.get('token') as string

    if (!email || !token) {
        return { error: 'Email and verification code are required' }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
    })

    if (error) {
        console.error('[v0] OTP verification error:', error.message)
        return { error: 'Invalid or expired verification code. Please try again.' }
    }

    return { success: true }
}

// Get current admin user and their organization
export async function getAdminUser() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return null
    }

    const adminClient = createAdminClient()

    // Get profile with role
    const { data: profile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // Check if master admin (use admin_role column, not role which is for journey roles)
    if (profile?.admin_role === 'master_admin') {
        return {
            user,
            profile,
            isMasterAdmin: true,
            organization: null,
        }
    }

    // Get organization where user is owner
    const { data: org } = await adminClient
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .single()

    // Or where their email matches subscription purchaser
    if (!org) {
        const { data: sub } = await adminClient
            .from('subscriptions')
            .select('organization_id, organizations(*)')
            .eq('purchaser_email', user.email)
            .not('organization_id', 'is', null)
            .single()

        if (sub?.organizations) {
            return {
                user,
                profile,
                isMasterAdmin: false,
                organization: sub.organizations,
            }
        }
    }

    return {
        user,
        profile,
        isMasterAdmin: false,
        organization: org,
    }
}

// Admin sign out
export async function adminSignOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/admin/login')
}
