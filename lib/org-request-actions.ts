'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface SubmitRequestParams {
    userId: string
    organizationId: string
    requestType: 'become_leader' | 'new_journey'
    notes?: string
}

export async function submitOrgMemberRequest(params: SubmitRequestParams) {
    const { userId, organizationId, requestType, notes } = params
    const adminClient = createAdminClient()

    try {
        // Get user profile for the request
        const { data: profile } = await adminClient
            .from('profiles')
            .select('full_name, email:id')
            .eq('id', userId)
            .single()

        // Check if there's already a pending request of this type
        const { data: existingRequest } = await adminClient
            .from('org_member_requests')
            .select('id')
            .eq('user_id', userId)
            .eq('organization_id', organizationId)
            .eq('request_type', requestType)
            .eq('status', 'pending')
            .single()

        if (existingRequest) {
            return { error: 'You already have a pending request of this type' }
        }

        // Create the request
        const { data: request, error } = await adminClient
            .from('org_member_requests')
            .insert({
                user_id: userId,
                organization_id: organizationId,
                request_type: requestType,
                notes: notes || null,
                status: 'pending',
            })
            .select()
            .single()

        if (error) {
            console.error('Failed to create request:', error)
            return { error: 'Failed to submit request' }
        }

        // Get org admin to notify them
        const { data: org } = await adminClient
            .from('organizations')
            .select('owner_id, admin_email, name')
            .eq('id', organizationId)
            .single()

        if (org?.owner_id) {
            // Create notification for org admin
            await adminClient
                .from('notifications')
                .insert({
                    user_id: org.owner_id,
                    type: 'member_request',
                    title: `New ${requestType === 'become_leader' ? 'Leader' : 'Journey'} Request`,
                    message: `${profile?.full_name || 'A member'} has requested to ${requestType === 'become_leader' ? 'become a leader' : 'start a new journey'}`,
                    metadata: {
                        request_id: request.id,
                        requester_name: profile?.full_name,
                        request_type: requestType,
                    },
                })
        }

        revalidatePath('/admin/dashboard')
        revalidatePath('/admin/dashboard/requests')

        return { success: true, requestId: request.id }
    } catch (error) {
        console.error('Error submitting request:', error)
        return { error: 'An unexpected error occurred' }
    }
}

interface ApproveRequestParams {
    requestId: string
    accessCodeId?: string // For new journeys, assign an access code
    notes?: string
}

export async function approveOrgMemberRequest(params: ApproveRequestParams) {
    const { requestId, accessCodeId, notes } = params
    const adminClient = createAdminClient()

    try {
        // Get the request details
        const { data: request, error: requestError } = await adminClient
            .from('org_member_requests')
            .select(`
        *,
        user:profiles!user_id(id, full_name, email:id),
        organization:organizations(id, name)
      `)
            .eq('id', requestId)
            .single()

        if (requestError || !request) {
            return { error: 'Request not found' }
        }

        if (request.status !== 'pending') {
            return { error: 'Request has already been processed' }
        }

        // Update request status
        const { error: updateError } = await adminClient
            .from('org_member_requests')
            .update({
                status: 'approved',
                admin_notes: notes || null,
                resolved_at: new Date().toISOString(),
                assigned_access_code_id: accessCodeId || null,
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('Failed to approve request:', updateError)
            return { error: 'Failed to approve request' }
        }

        // Handle the approval based on request type
        if (request.request_type === 'become_leader') {
            // Mark their current pairing as graduated (leader role)
            const { data: activePairing } = await adminClient
                .from('pairings')
                .select('id')
                .eq('learner_id', request.user_id)
                .eq('status', 'active')
                .single()

            if (activePairing) {
                await adminClient
                    .from('pairings')
                    .update({
                        status: 'graduated',
                        graduated_at: new Date().toISOString(),
                    })
                    .eq('id', activePairing.id)

                // Update their profile to leader role
                await adminClient
                    .from('profiles')
                    .update({ role: 'leader' })
                    .eq('id', request.user_id)
            }
        } else if (request.request_type === 'new_journey' && accessCodeId) {
            // Assign the access code to the user
            await adminClient
                .from('access_codes')
                .update({
                    assigned_to_email: request.user?.email,
                    assigned_at: new Date().toISOString(),
                })
                .eq('id', accessCodeId)
        }

        // Notify the user
        await adminClient
            .from('notifications')
            .insert({
                user_id: request.user_id,
                type: 'request_approved',
                title: 'Request Approved!',
                message: request.request_type === 'become_leader'
                    ? 'Your request to become a leader has been approved. You can now mentor learners!'
                    : 'Your request for a new journey has been approved. Check your dashboard to get started!',
                metadata: {
                    request_id: requestId,
                    request_type: request.request_type,
                },
            })

        revalidatePath('/admin/dashboard')
        revalidatePath('/admin/dashboard/requests')
        revalidatePath('/dashboard')

        return { success: true }
    } catch (error) {
        console.error('Error approving request:', error)
        return { error: 'An unexpected error occurred' }
    }
}

export async function denyOrgMemberRequest(requestId: string, adminNotes?: string) {
    const adminClient = createAdminClient()

    try {
        // Get the request details
        const { data: request, error: requestError } = await adminClient
            .from('org_member_requests')
            .select('user_id, request_type')
            .eq('id', requestId)
            .single()

        if (requestError || !request) {
            return { error: 'Request not found' }
        }

        // Update request status
        const { error: updateError } = await adminClient
            .from('org_member_requests')
            .update({
                status: 'denied',
                admin_notes: adminNotes || null,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', requestId)

        if (updateError) {
            console.error('Failed to deny request:', updateError)
            return { error: 'Failed to deny request' }
        }

        // Notify the user
        await adminClient
            .from('notifications')
            .insert({
                user_id: request.user_id,
                type: 'request_denied',
                title: 'Request Update',
                message: request.request_type === 'become_leader'
                    ? 'Your leader request could not be approved at this time. Contact your admin for more details.'
                    : 'Your journey request could not be approved at this time. Contact your admin for more details.',
                metadata: {
                    request_id: requestId,
                    request_type: request.request_type,
                },
            })

        revalidatePath('/admin/dashboard')
        revalidatePath('/admin/dashboard/requests')

        return { success: true }
    } catch (error) {
        console.error('Error denying request:', error)
        return { error: 'An unexpected error occurred' }
    }
}

export async function getOrgMemberRequests(organizationId: string) {
    const adminClient = createAdminClient()

    try {
        const { data: requests, error } = await adminClient
            .from('org_member_requests')
            .select(`
        *,
        user:profiles!user_id(id, full_name, avatar_url, email:id),
        assigned_access_code:access_codes(id, code, tier:subscription_tiers(name), journey:journeys(name))
      `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch requests:', error)
            return { error: 'Failed to fetch requests' }
        }

        return { success: true, requests }
    } catch (error) {
        console.error('Error fetching requests:', error)
        return { error: 'An unexpected error occurred' }
    }
}

export async function getPendingRequestCount(organizationId: string) {
    const adminClient = createAdminClient()

    try {
        const { count, error } = await adminClient
            .from('org_member_requests')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'pending')

        if (error) {
            console.error('Failed to fetch pending count:', error)
            return { count: 0 }
        }

        return { count: count || 0 }
    } catch (error) {
        console.error('Error fetching pending count:', error)
        return { count: 0 }
    }
}
