'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface BrandingUpdate {
    church_name: string | null
    slogan: string | null
    primary_color: string | null
    secondary_color: string | null
    logo_url: string | null
}

export async function updateOrgBranding(organizationId: string, branding: BrandingUpdate) {
    const supabase = await createClient()

    // Verify user is an org admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, admin_role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.organization_id !== organizationId || profile.admin_role !== 'org_admin') {
        return { error: 'You do not have permission to update this organization' }
    }

    const { error } = await supabase
        .from('organizations')
        .update({
            branding_church_name: branding.church_name,
            branding_slogan: branding.slogan,
            branding_primary_color: branding.primary_color,
            branding_secondary_color: branding.secondary_color,
            branding_logo_url: branding.logo_url,
        })
        .eq('id', organizationId)

    if (error) {
        console.error('Error updating org branding:', error)
        return { error: 'Failed to update organization branding' }
    }

    // Revalidate all pages that use branding
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/admin', 'layout')

    return { success: true }
}

export async function getOrgBranding(organizationId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('organizations')
        .select('branding_logo_url, branding_church_name, branding_slogan, branding_primary_color, branding_secondary_color')
        .eq('id', organizationId)
        .single()

    if (error) {
        console.error('Error fetching org branding:', error)
        return null
    }

    return {
        logo_url: data.branding_logo_url,
        church_name: data.branding_church_name,
        slogan: data.branding_slogan,
        primary_color: data.branding_primary_color,
        secondary_color: data.branding_secondary_color,
    }
}

export async function getUserOrgBranding() {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return null
    }

    // Get user's organization
    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

    if (!profile?.organization_id) {
        return null
    }

    // Get organization branding
    const { data: org, error } = await supabase
        .from('organizations')
        .select('name, branding_logo_url, branding_church_name, branding_slogan, branding_primary_color, branding_secondary_color')
        .eq('id', profile.organization_id)
        .single()

    if (error) {
        console.error('Error fetching user org branding:', error)
        return null
    }

    return {
        logoUrl: org.branding_logo_url,
        churchName: org.branding_church_name,
        slogan: org.branding_slogan,
        primaryColor: org.branding_primary_color,
        secondaryColor: org.branding_secondary_color,
        organizationName: org.name,
    }
}
