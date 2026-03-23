import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { organizationId, newAdminId } = await request.json()

        if (!organizationId || !newAdminId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        const adminClient = createAdminClient()

        // Verify the current user is an org admin for this organization
        const { data: currentProfile } = await adminClient
            .from('profiles')
            .select('admin_role, organization_id')
            .eq('id', user.id)
            .single()

        if (!currentProfile || currentProfile.admin_role !== 'org_admin') {
            return NextResponse.json(
                { error: 'Only organization admins can transfer ownership' },
                { status: 403 }
            )
        }

        if (currentProfile.organization_id !== organizationId) {
            return NextResponse.json(
                { error: 'You can only transfer ownership of your own organization' },
                { status: 403 }
            )
        }

        // Verify the new admin is a member of the organization
        const { data: newAdmin } = await adminClient
            .from('profiles')
            .select('id, organization_id, admin_role')
            .eq('id', newAdminId)
            .single()

        if (!newAdmin) {
            return NextResponse.json(
                { error: 'Selected member not found' },
                { status: 404 }
            )
        }

        if (newAdmin.organization_id !== organizationId) {
            return NextResponse.json(
                { error: 'Selected member is not part of this organization' },
                { status: 400 }
            )
        }

        // Transfer ownership: update new admin's role
        const { error: updateNewAdminError } = await adminClient
            .from('profiles')
            .update({ admin_role: 'org_admin' })
            .eq('id', newAdminId)

        if (updateNewAdminError) {
            console.error('Error updating new admin:', updateNewAdminError)
            return NextResponse.json(
                { error: 'Failed to transfer ownership' },
                { status: 500 }
            )
        }

        // Remove admin role from current admin
        const { error: updateOldAdminError } = await adminClient
            .from('profiles')
            .update({ admin_role: null })
            .eq('id', user.id)

        if (updateOldAdminError) {
            // Try to rollback the new admin update
            await adminClient
                .from('profiles')
                .update({ admin_role: newAdmin.admin_role })
                .eq('id', newAdminId)

            console.error('Error removing old admin role:', updateOldAdminError)
            return NextResponse.json(
                { error: 'Failed to transfer ownership' },
                { status: 500 }
            )
        }

        // Update the organization's admin_email to the new admin's email
        const { data: newAdminEmail } = await adminClient
            .from('profiles')
            .select('email')
            .eq('id', newAdminId)
            .single()

        if (newAdminEmail?.email) {
            await adminClient
                .from('organizations')
                .update({ admin_email: newAdminEmail.email })
                .eq('id', organizationId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Transfer ownership error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
