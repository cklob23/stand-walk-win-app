'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Profile, SubscriptionTier, Journey, UserJourney, AdminRole, Organization, OrganizationMember } from '@/lib/types'

// Admin role hierarchy
export type AdminPermissions = {
    canManageAllUsers: boolean
    canManageTiers: boolean
    canManageJourneys: boolean
    canManageOrganizations: boolean
    canManageOrgUsers: boolean
    canPromoteToAdmin: boolean
    organizationId: string | null
}

// Check current user's admin role and permissions
export async function getAdminPermissions(): Promise<{
    isAdmin: boolean
    role: AdminRole | null
    permissions: AdminPermissions
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const noPermissions: AdminPermissions = {
        canManageAllUsers: false,
        canManageTiers: false,
        canManageJourneys: false,
        canManageOrganizations: false,
        canManageOrgUsers: false,
        canPromoteToAdmin: false,
        organizationId: null,
    }

    if (!user) return { isAdmin: false, role: null, permissions: noPermissions }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, admin_role, organization_id')
        .eq('id', user.id)
        .single()

    if (!profile?.is_admin && !profile?.admin_role) {
        return { isAdmin: false, role: null, permissions: noPermissions }
    }

    const adminRole = profile.admin_role as AdminRole | null

    // Master admin has all permissions
    if (adminRole === 'master_admin') {
        return {
            isAdmin: true,
            role: 'master_admin',
            permissions: {
                canManageAllUsers: true,
                canManageTiers: true,
                canManageJourneys: true,
                canManageOrganizations: true,
                canManageOrgUsers: true,
                canPromoteToAdmin: true,
                organizationId: null,
            }
        }
    }

    // Org admin has limited permissions
    if (adminRole === 'org_admin') {
        return {
            isAdmin: true,
            role: 'org_admin',
            permissions: {
                canManageAllUsers: false,
                canManageTiers: false,
                canManageJourneys: false,
                canManageOrganizations: false,
                canManageOrgUsers: true,
                canPromoteToAdmin: false,
                organizationId: profile.organization_id,
            }
        }
    }

    // Legacy is_admin without admin_role - treat as master admin for backwards compatibility
    if (profile.is_admin) {
        return {
            isAdmin: true,
            role: 'master_admin',
            permissions: {
                canManageAllUsers: true,
                canManageTiers: true,
                canManageJourneys: true,
                canManageOrganizations: true,
                canManageOrgUsers: true,
                canPromoteToAdmin: true,
                organizationId: null,
            }
        }
    }

    return { isAdmin: false, role: null, permissions: noPermissions }
}

// Check if current user is admin (legacy function for backwards compatibility)
export async function isCurrentUserAdmin(): Promise<boolean> {
    const { isAdmin } = await getAdminPermissions()
    return isAdmin
}

// Get all users with their subscription info (admin only)
export async function getAllUsers(): Promise<{
    success: boolean
    users?: (Profile & {
        subscription_tier: SubscriptionTier | null
        learner_count: number
        journey_count: number
    })[]
    error?: string
}> {
    const { isAdmin, permissions } = await getAdminPermissions()
    if (!isAdmin) return { success: false, error: 'Not authorized' }

    const adminSupabase = createAdminClient()

    // Build query based on permissions
    let query = adminSupabase
        .from('profiles')
        .select(`
      *,
      subscription_tier:subscription_tiers(*)
    `)
        .order('created_at', { ascending: false })

    // Org admins can only see users in their organization
    if (!permissions.canManageAllUsers && permissions.organizationId) {
        query = query.eq('organization_id', permissions.organizationId)
    }

    const { data: profiles, error } = await query

    if (error) {
        console.error('Error fetching users:', error)
        return { success: false, error: error.message }
    }

    // Get learner counts for each user (as leader)
    const usersWithCounts = await Promise.all(
        (profiles || []).map(async (profile) => {
            // Count learners where this user is the leader
            const { count: learnerCount } = await adminSupabase
                .from('pairings')
                .select('*', { count: 'exact', head: true })
                .eq('leader_id', profile.id)
                .eq('status', 'active')

            // Count journeys
            const { count: journeyCount } = await adminSupabase
                .from('user_journeys')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profile.id)

            return {
                ...profile,
                learner_count: learnerCount || 0,
                journey_count: journeyCount || 0,
            }
        })
    )

    return { success: true, users: usersWithCounts }
}

// Get all subscription tiers
export async function getSubscriptionTiers(): Promise<{
    success: boolean
    tiers?: SubscriptionTier[]
    error?: string
}> {
    const supabase = await createClient()

    const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

    if (error) {
        console.error('Error fetching tiers:', error)
        return { success: false, error: error.message }
    }

    return { success: true, tiers: tiers || [] }
}

// Get all journeys (admin)
export async function getAllJourneys(): Promise<{
    success: boolean
    journeys?: Journey[]
    error?: string
}> {
    const supabase = await createClient()

    const { data: journeys, error } = await supabase
        .from('journeys')
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching journeys:', error)
        return { success: false, error: error.message }
    }

    return { success: true, journeys: journeys || [] }
}

// Update user's subscription tier (admin only)
export async function updateUserTier(
    userId: string,
    newTierId: string | null,
    reason?: string,
    paymentReference?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check admin status
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!adminProfile?.is_admin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    // Get current tier
    const { data: currentProfile } = await adminSupabase
        .from('profiles')
        .select('subscription_tier_id')
        .eq('id', userId)
        .single()

    // Update the user's tier
    const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({
            subscription_tier_id: newTierId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (updateError) {
        console.error('Error updating user tier:', updateError)
        return { success: false, error: updateError.message }
    }

    // Log the change
    await adminSupabase
        .from('subscription_changes')
        .insert({
            user_id: userId,
            old_tier_id: currentProfile?.subscription_tier_id || null,
            new_tier_id: newTierId,
            changed_by: user.id,
            reason: reason || null,
            payment_reference: paymentReference || null,
        })

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Grant journey access to user (admin only)
export async function grantJourneyAccess(
    userId: string,
    journeyId: string,
    paymentReference?: string,
    paymentAmount?: number,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check admin status
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!adminProfile?.is_admin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    // Check if user already has access
    const { data: existingPurchase } = await adminSupabase
        .from('user_journey_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('journey_id', journeyId)
        .single()

    if (existingPurchase) {
        return { success: false, error: 'User already has access to this journey' }
    }

    // Grant access
    const { error } = await adminSupabase
        .from('user_journey_purchases')
        .insert({
            user_id: userId,
            journey_id: journeyId,
            payment_reference: paymentReference || null,
            payment_amount: paymentAmount || null,
            granted_by: user.id,
            notes: notes || null,
        })

    if (error) {
        console.error('Error granting journey access:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Toggle user admin status (super admin only - first admin in system)
export async function toggleUserAdmin(
    userId: string,
    isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check admin status
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!adminProfile?.is_admin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
        .from('profiles')
        .update({
            is_admin: isAdmin,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        console.error('Error toggling admin status:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Toggle user's can_be_leader status
export async function toggleCanBeLeader(
    userId: string,
    canBeLeader: boolean
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check admin status
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!adminProfile?.is_admin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
        .from('profiles')
        .update({
            can_be_leader: canBeLeader,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        console.error('Error toggling can_be_leader:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Get admin stats
export async function getAdminStats(): Promise<{
    success: boolean
    stats?: {
        totalUsers: number
        activeLeaders: number
        activeLearners: number
        completedJourneys: number
        activePairings: number
        tierBreakdown: { tier: string; count: number }[]
    }
    error?: string
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Check admin status
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

    if (!adminProfile?.is_admin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    // Total users
    const { count: totalUsers } = await adminSupabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    // Active leaders
    const { count: activeLeaders } = await adminSupabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'leader')

    // Active learners
    const { count: activeLearners } = await adminSupabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'learner')

    // Completed journeys
    const { count: completedJourneys } = await adminSupabase
        .from('user_journeys')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')

    // Active pairings
    const { count: activePairings } = await adminSupabase
        .from('pairings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

    // Tier breakdown
    const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('subscription_tier_id')

    const { data: tiers } = await adminSupabase
        .from('subscription_tiers')
        .select('id, display_name')

    const tierMap = new Map<string, string>(
        tiers?.map((t: { id: string; display_name: string }) => [t.id, t.display_name]) || []
    )
    const tierCounts: Record<string, number> = {}

    profiles?.forEach((p: { subscription_tier_id: string | null }) => {
        const tierName = p.subscription_tier_id ? (tierMap.get(p.subscription_tier_id) || 'Unknown') : 'No Tier'
        tierCounts[tierName] = (tierCounts[tierName] || 0) + 1
    })

    return {
        success: true,
        stats: {
            totalUsers: totalUsers || 0,
            activeLeaders: activeLeaders || 0,
            activeLearners: activeLearners || 0,
            completedJourneys: completedJourneys || 0,
            activePairings: activePairings || 0,
            tierBreakdown: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
        }
    }
}

// ==================== ORGANIZATION MANAGEMENT ====================

// Get all organizations (all admins can view for reference)
export async function getAllOrganizations(): Promise<{
    success: boolean
    organizations?: (Organization & { member_count: number })[]
    error?: string
}> {
    const { isAdmin } = await getAdminPermissions()
    if (!isAdmin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    const { data: organizations, error } = await adminSupabase
        .from('organizations')
        .select(`
      *,
      subscription_tier:subscription_tiers(*)
    `)
        .order('name')

    if (error) {
        console.error('Error fetching organizations:', error)
        return { success: false, error: error.message }
    }

    // Get member counts - count from organization_members table (primary source)
    // Also count claimed access codes as fallback
    const orgsWithCounts = await Promise.all(
        (organizations || []).map(async (org) => {
            // First try organization_members table
            const { count: membersCount } = await adminSupabase
                .from('organization_members')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)

            // Also count profiles with this organization_id who have a journey role (actual journey participants)
            const { count: profilesCount } = await adminSupabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', org.id)
                .not('role', 'is', null)

            // Use the higher count (organization_members or profiles with journey role)
            const memberCount = Math.max(membersCount || 0, profilesCount || 0)

            return {
                ...org,
                member_count: memberCount
            }
        })
    )

    return { success: true, organizations: orgsWithCounts }
}

// Create organization (master admin only)
export async function createOrganization(
    name: string,
    maxMembers: number,
    subscriptionTierId: string | null,
    description?: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { isAdmin, permissions } = await getAdminPermissions()
    if (!isAdmin || !permissions.canManageOrganizations) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const { data: organization, error } = await adminSupabase
        .from('organizations')
        .insert({
            name,
            slug,
            description: description || null,
            max_users: maxMembers,
            subscription_tier_id: subscriptionTierId,
            owner_id: user.id,
        })
        .select()
        .single()

    if (error) {
        console.error('Error creating organization:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true, organization }
}

// Update organization (master admin only)
export async function updateOrganization(
    organizationId: string,
    updates: {
        name?: string
        description?: string
        max_users?: number
        subscription_tier_id?: string | null
        is_active?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    const { isAdmin, permissions } = await getAdminPermissions()
    if (!isAdmin || !permissions.canManageOrganizations) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

    // Update slug if name changed
    if (updates.name) {
        updateData.slug = updates.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }

    const { error } = await adminSupabase
        .from('organizations')
        .update(updateData)
        .eq('id', organizationId)

    if (error) {
        console.error('Error updating organization:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Add user to organization (master admin or org admin)
export async function addUserToOrganization(
    userId: string,
    organizationId: string,
    role: 'admin' | 'member' = 'member'
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { isAdmin, permissions } = await getAdminPermissions()

    // Check permissions - master admin can add to any org, org admin only to their org
    if (!isAdmin) return { success: false, error: 'Not authorized' }
    if (!permissions.canManageAllUsers && permissions.organizationId !== organizationId) {
        return { success: false, error: 'Not authorized for this organization' }
    }

    const adminSupabase = createAdminClient()

    // Check organization member limit (count from profiles table)
    const { data: org } = await adminSupabase
        .from('organizations')
        .select('max_users')
        .eq('id', organizationId)
        .single()

    const { count: currentMembers } = await adminSupabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

    if (org && currentMembers !== null && currentMembers >= org.max_users) {
        return { success: false, error: `Organization has reached its member limit of ${org.max_users}` }
    }

    // Add to organization_members table
    const { error: memberError } = await adminSupabase
        .from('organization_members')
        .insert({
            organization_id: organizationId,
            user_id: userId,
            role,
            added_by: user.id,
        })

    if (memberError) {
        console.error('Error adding user to organization:', memberError)
        return { success: false, error: memberError.message }
    }

    // Update user's profile with organization_id
    const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({
            organization_id: organizationId,
            // If adding as org admin, set their admin_role
            ...(role === 'admin' ? { admin_role: 'org_admin', is_admin: true } : {})
        })
        .eq('id', userId)

    if (profileError) {
        console.error('Error updating user profile:', profileError)
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Remove user from organization (master admin or org admin)
export async function removeUserFromOrganization(
    userId: string,
    organizationId: string
): Promise<{ success: boolean; error?: string }> {
    const { isAdmin, permissions } = await getAdminPermissions()

    if (!isAdmin) return { success: false, error: 'Not authorized' }
    if (!permissions.canManageAllUsers && permissions.organizationId !== organizationId) {
        return { success: false, error: 'Not authorized for this organization' }
    }

    const adminSupabase = createAdminClient()

    // Remove from organization_members
    const { error: memberError } = await adminSupabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId)

    if (memberError) {
        console.error('Error removing user from organization:', memberError)
        return { success: false, error: memberError.message }
    }

    // Clear organization_id from profile and reset org admin role if applicable
    const { error: profileError } = await adminSupabase
        .from('profiles')
        .update({
            organization_id: null,
            admin_role: null,
            is_admin: false,
        })
        .eq('id', userId)
        .eq('admin_role', 'org_admin') // Only reset if they were an org admin

    if (profileError) {
        console.error('Error updating user profile:', profileError)
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Get organization members (master admin or org admin of that org)
export async function getOrganizationMembers(organizationId: string): Promise<{
    success: boolean
    members?: OrganizationMember[]
    organization?: Organization
    error?: string
}> {
    const { isAdmin, permissions } = await getAdminPermissions()

    if (!isAdmin) return { success: false, error: 'Not authorized' }
    if (!permissions.canManageAllUsers && permissions.organizationId !== organizationId) {
        return { success: false, error: 'Not authorized for this organization' }
    }

    const adminSupabase = createAdminClient()

    const { data: organization, error: orgError } = await adminSupabase
        .from('organizations')
        .select(`
      *,
      subscription_tier:subscription_tiers(*)
    `)
        .eq('id', organizationId)
        .single()

    if (orgError) {
        console.error('Error fetching organization:', orgError)
        return { success: false, error: orgError.message }
    }

    // Get members directly from profiles table where organization_id matches
    const { data: profileMembers, error: profileError } = await adminSupabase
        .from('profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

    if (profileError) {
        console.error('Error fetching profile members:', profileError)
        return { success: false, error: profileError.message }
    }

    // Convert profiles to OrganizationMember format
    const members: OrganizationMember[] = (profileMembers || []).map(p => ({
        id: `profile-${p.id}`,
        organization_id: organizationId,
        user_id: p.id,
        role: p.admin_role === 'org_admin' ? 'admin' : 'member',
        added_by: null,
        created_at: p.created_at,
        user: p as Profile
    }))

    return { success: true, members, organization }
}

// Set user admin role (master admin only)
export async function setUserAdminRole(
    userId: string,
    adminRole: AdminRole | null,
    organizationId?: string | null
): Promise<{ success: boolean; error?: string }> {
    const { isAdmin, permissions } = await getAdminPermissions()
    if (!isAdmin || !permissions.canPromoteToAdmin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = createAdminClient()

    const { error } = await adminSupabase
        .from('profiles')
        .update({
            admin_role: adminRole,
            is_admin: adminRole !== null,
            organization_id: adminRole === 'org_admin' ? organizationId : null,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) {
        console.error('Error setting admin role:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/admin')
    return { success: true }
}

// Get users available to add to an organization (those not in any org)
export async function getAvailableUsersForOrg(): Promise<{
    success: boolean
    users?: (Profile & { subscription_tier: SubscriptionTier | null })[]
    error?: string
}> {
    const { isAdmin } = await getAdminPermissions()
    if (!isAdmin) {
        return { success: false, error: 'Not authorized' }
    }

    const adminSupabase = await createAdminClient()

    const { data: users, error } = await adminSupabase
        .from('profiles')
        .select(`
      *,
      subscription_tier:subscription_tiers(*)
    `)
        .is('organization_id', null)
        .order('full_name', { ascending: true })

    if (error) {
        console.error('Error fetching available users:', error)
        return { success: false, error: error.message }
    }

    return { success: true, users: users || [] }
}
