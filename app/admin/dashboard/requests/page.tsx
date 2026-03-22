'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { redirect } from 'next/navigation'
import { RequestsContent } from './requests-content'

export default async function RequestsPage() {
    const adminUser = await getAdminUser()
    if (!adminUser) {
        redirect('/admin/login')
    }

    const supabase = createAdminClient()

    // Fetch pending requests for this organization
    const { data: requests, error } = await supabase
        .from('org_member_requests')
        .select(`
      id,
      user_id,
      request_type,
      status,
      notes,
      admin_response,
      created_at,
      updated_at,
      user:profiles!org_member_requests_user_id_fkey(
        id,
        full_name,
        email,
        avatar_url
      )
    `)
        .eq('organization_id', adminUser.organization.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching requests:', error)
    }

    // Fetch available access codes for assigning
    const { data: availableCodes } = await supabase
        .from('access_codes')
        .select(`
      id,
      code,
      tier_id,
      journey_id,
      tier:subscription_tiers(name),
      journey:journeys(name)
    `)
        .eq('organization_id', adminUser.organization.id)
        .is('claimed_by', null)
        .eq('is_active', true)

    // Helper to extract first element from Supabase join arrays
    function extractFirst<T>(data: T | T[] | null): T | null {
        if (!data) return null
        return Array.isArray(data) ? data[0] || null : data
    }

    // Transform requests data
    const transformedRequests = (requests || []).map(req => ({
        ...req,
        user: extractFirst(req.user as any),
    }))

    // Transform access codes data
    const transformedCodes = (availableCodes || []).map(code => ({
        ...code,
        tier: extractFirst(code.tier as any),
        journey: extractFirst(code.journey as any),
    }))

    return (
        <RequestsContent
            requests={transformedRequests as any}
            availableCodes={transformedCodes as any}
            organizationId={adminUser.organization.id}
        />
    )
}
