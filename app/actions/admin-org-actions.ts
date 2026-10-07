'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { revalidatePath } from 'next/cache'
import type { Organization } from '@/lib/types'

export type OrgFormOptions = {
    tiers: { id: string; name: string; display_name: string }[]
}

export type CreateOrganizationInput = {
    name: string
    adminEmail?: string | null
    description?: string | null
    maxUsers?: number
    subscriptionTierId?: string | null
}

export type UpdateOrganizationInput = {
    organizationId: string
    name: string
    adminEmail?: string | null
    description?: string | null
    maxUsers?: number
    subscriptionTierId?: string | null
    isActive: boolean
}

async function requireMasterAdmin() {
    const adminData = await getAdminUser()
    if (!adminData?.isMasterAdmin) {
        return { error: 'Unauthorized - Master admin access required' as const, adminData: null }
    }
    return { error: null, adminData }
}

function slugify(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return slug || 'organization'
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function uniqueSlug(
    supabase: ReturnType<typeof createAdminClient>,
    name: string,
    excludeId?: string
) {
    const base = slugify(name)
    let candidate = base
    let suffix = 0

    while (true) {
        let query = supabase.from('organizations').select('id').eq('slug', candidate)
        if (excludeId) {
            query = query.neq('id', excludeId)
        }
        const { data } = await query.maybeSingle()
        if (!data) return candidate
        suffix += 1
        candidate = `${base}-${suffix}`
    }
}

function revalidateOrgPaths(organizationId?: string) {
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/dashboard/organizations')
    revalidatePath('/admin/dashboard/users')
    if (organizationId) {
        revalidatePath(`/admin/dashboard/organizations/${organizationId}`)
    }
}

export async function getOrgFormOptions(): Promise<{
    success?: boolean
    options?: OrgFormOptions
    error?: string
}> {
    const { error } = await requireMasterAdmin()
    if (error) return { error }

    const supabase = createAdminClient()
    const { data: tiers } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

    return {
        success: true,
        options: {
            tiers: tiers || [],
        },
    }
}

export async function createOrganizationRecord(input: CreateOrganizationInput): Promise<{
    success?: boolean
    organization?: Organization
    error?: string
}> {
    const { error: authError } = await requireMasterAdmin()
    if (authError) return { error: authError }

    const name = input.name.trim()
    const adminEmail = input.adminEmail?.trim().toLowerCase() || null
    const description = input.description?.trim() || null
    const maxUsers = Number.isFinite(input.maxUsers) ? Math.floor(input.maxUsers as number) : 10

    if (!name) {
        return { error: 'Organization name is required' }
    }
    if (name.length < 2) {
        return { error: 'Organization name must be at least 2 characters' }
    }
    if (adminEmail && !isValidEmail(adminEmail)) {
        return { error: 'Enter a valid admin email, or leave it blank' }
    }
    if (maxUsers < 1) {
        return { error: 'Max members must be at least 1' }
    }

    const supabase = createAdminClient()

    if (input.subscriptionTierId) {
        const { data: tier } = await supabase
            .from('subscription_tiers')
            .select('id')
            .eq('id', input.subscriptionTierId)
            .maybeSingle()
        if (!tier) {
            return { error: 'Selected plan was not found' }
        }
    }

    const slug = await uniqueSlug(supabase, name)

    const { data: organization, error } = await supabase
        .from('organizations')
        .insert({
            name,
            slug,
            description,
            admin_email: adminEmail,
            max_users: maxUsers,
            subscription_tier_id: input.subscriptionTierId || null,
            is_active: true,
            branding_primary_color: '#0f6353',
            branding_secondary_color: '#f0ede6',
        })
        .select()
        .single()

    if (error || !organization) {
        console.error('Error creating organization:', error)
        return { error: error?.message || 'Failed to create organization' }
    }

    revalidateOrgPaths(organization.id)
    return { success: true, organization }
}

export async function updateOrganizationRecord(input: UpdateOrganizationInput): Promise<{
    success?: boolean
    error?: string
}> {
    const { error: authError } = await requireMasterAdmin()
    if (authError) return { error: authError }

    const name = input.name.trim()
    const adminEmail = input.adminEmail?.trim().toLowerCase() || null
    const description = input.description?.trim() || null
    const maxUsers = Number.isFinite(input.maxUsers) ? Math.floor(input.maxUsers as number) : 10

    if (!input.organizationId) {
        return { error: 'Organization is required' }
    }
    if (!name) {
        return { error: 'Organization name is required' }
    }
    if (name.length < 2) {
        return { error: 'Organization name must be at least 2 characters' }
    }
    if (adminEmail && !isValidEmail(adminEmail)) {
        return { error: 'Enter a valid admin email, or leave it blank' }
    }
    if (maxUsers < 1) {
        return { error: 'Max members must be at least 1' }
    }

    const supabase = createAdminClient()

    const { data: current, error: currentError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', input.organizationId)
        .single()

    if (currentError || !current) {
        return { error: 'Organization not found' }
    }

    if (input.subscriptionTierId) {
        const { data: tier } = await supabase
            .from('subscription_tiers')
            .select('id')
            .eq('id', input.subscriptionTierId)
            .maybeSingle()
        if (!tier) {
            return { error: 'Selected plan was not found' }
        }
    }

    const slug = await uniqueSlug(supabase, name, input.organizationId)

    const { error } = await supabase
        .from('organizations')
        .update({
            name,
            slug,
            description,
            admin_email: adminEmail,
            max_users: maxUsers,
            subscription_tier_id: input.subscriptionTierId || null,
            is_active: input.isActive,
            updated_at: new Date().toISOString(),
        })
        .eq('id', input.organizationId)

    if (error) {
        console.error('Error updating organization:', error)
        return { error: error.message }
    }

    revalidateOrgPaths(input.organizationId)
    return { success: true }
}

export async function deleteOrganizationRecord(organizationId: string): Promise<{
    success?: boolean
    error?: string
}> {
    const { error: authError } = await requireMasterAdmin()
    if (authError) return { error: authError }

    if (!organizationId) {
        return { error: 'Organization is required' }
    }

    const supabase = createAdminClient()

    const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single()

    if (orgError || !organization) {
        return { error: 'Organization not found' }
    }

    const [{ count: profileCount }, { count: memberCount }, { count: claimedCodeCount }] = await Promise.all([
        supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
        supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId),
        supabase
            .from('access_codes')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'claimed'),
    ])

    const assignedUsers = profileCount || 0
    const memberships = memberCount || 0
    const claimedCodes = claimedCodeCount || 0

    if (assignedUsers > 0 || memberships > 0 || claimedCodes > 0) {
        const relatedUsers = Math.max(assignedUsers, memberships)
        const reasons = [
            relatedUsers > 0 ? `${relatedUsers} assigned user${relatedUsers === 1 ? '' : 's'}` : null,
            claimedCodes > 0 ? `${claimedCodes} claimed access code${claimedCodes === 1 ? '' : 's'}` : null,
        ].filter(Boolean)
        return {
            error: `Cannot delete "${organization.name}" while it still has ${reasons.join(' and ')}. Reassign or remove those users from All Users first, or deactivate the organization instead.`,
        }
    }

    const { error: requestsError } = await supabase
        .from('org_member_requests')
        .delete()
        .eq('organization_id', organizationId)
    if (requestsError) {
        console.error('Error deleting org_member_requests:', requestsError)
        return { error: `Failed to delete organization requests: ${requestsError.message}` }
    }

    const { error: codesError } = await supabase
        .from('access_codes')
        .delete()
        .eq('organization_id', organizationId)
        .eq('status', 'available')
    if (codesError) {
        console.error('Error deleting unused access_codes:', codesError)
        return { error: `Failed to delete unused access codes: ${codesError.message}` }
    }

    const { error: membersError } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
    if (membersError) {
        console.error('Error deleting organization_members:', membersError)
        return { error: `Failed to delete organization memberships: ${membersError.message}` }
    }

    const { error: subscriptionsError } = await supabase
        .from('subscriptions')
        .update({ organization_id: null })
        .eq('organization_id', organizationId)
    if (subscriptionsError) {
        console.error('Error unlinking subscriptions:', subscriptionsError)
        return { error: `Failed to unlink subscriptions: ${subscriptionsError.message}` }
    }

    const { error: deleteError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organizationId)

    if (deleteError) {
        console.error('Error deleting organization:', deleteError)
        return { error: `Failed to delete organization: ${deleteError.message}` }
    }

    revalidateOrgPaths()
    return { success: true }
}
