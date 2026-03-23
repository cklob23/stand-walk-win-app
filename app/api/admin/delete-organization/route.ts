import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { organizationId, confirmationPhrase } = await request.json()

        if (!organizationId || !confirmationPhrase) {
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
                { error: 'Only organization admins can delete the organization' },
                { status: 403 }
            )
        }

        if (currentProfile.organization_id !== organizationId) {
            return NextResponse.json(
                { error: 'You can only delete your own organization' },
                { status: 403 }
            )
        }

        // Get the organization to verify the confirmation phrase
        const { data: organization } = await adminClient
            .from('organizations')
            .select('name')
            .eq('id', organizationId)
            .single()

        if (!organization) {
            return NextResponse.json(
                { error: 'Organization not found' },
                { status: 404 }
            )
        }

        const expectedPhrase = `sudo delete ${organization.name}`
        if (confirmationPhrase !== expectedPhrase) {
            return NextResponse.json(
                { error: 'Invalid confirmation phrase' },
                { status: 400 }
            )
        }

        // Get all members of the organization
        const { data: members } = await adminClient
            .from('profiles')
            .select('id')
            .eq('organization_id', organizationId)

        const memberIds = members?.map(m => m.id) || []

        // Delete in order respecting foreign key constraints:

        // 1. Delete assignment progress for org members
        if (memberIds.length > 0) {
            await adminClient
                .from('assignment_progress')
                .delete()
                .in('user_id', memberIds)

            // 2. Delete assignment reactions for org members
            await adminClient
                .from('assignment_reactions')
                .delete()
                .in('user_id', memberIds)

            // 3. Delete reflections for org members
            await adminClient
                .from('reflections')
                .delete()
                .in('user_id', memberIds)

            // 4. Delete journal entries for org members
            await adminClient
                .from('journal_entries')
                .delete()
                .in('user_id', memberIds)

            // 5. Delete messages where org members are sender or recipient
            await adminClient
                .from('messages')
                .delete()
                .in('sender_id', memberIds)

            await adminClient
                .from('messages')
                .delete()
                .in('recipient_id', memberIds)

            // 6. Delete notifications for org members
            await adminClient
                .from('notifications')
                .delete()
                .in('user_id', memberIds)

            // 7. Delete scheduled meetings for org members
            await adminClient
                .from('scheduled_meetings')
                .delete()
                .in('leader_id', memberIds)

            // 8. Delete pairings where org members are involved
            await adminClient
                .from('pairings')
                .delete()
                .in('leader_id', memberIds)

            await adminClient
                .from('pairings')
                .delete()
                .in('learner_id', memberIds)
        }

        // 9. Delete org member requests
        await adminClient
            .from('org_member_requests')
            .delete()
            .eq('organization_id', organizationId)

        // 10. Delete access codes for this organization
        await adminClient
            .from('access_codes')
            .delete()
            .eq('organization_id', organizationId)

        // 11. Clear organization_id from member profiles (don't delete the profiles/auth users)
        if (memberIds.length > 0) {
            await adminClient
                .from('profiles')
                .update({
                    organization_id: null,
                    admin_role: null
                })
                .in('id', memberIds)
        }

        // 12. Delete the organization
        const { error: deleteOrgError } = await adminClient
            .from('organizations')
            .delete()
            .eq('id', organizationId)

        if (deleteOrgError) {
            console.error('Error deleting organization:', deleteOrgError)
            return NextResponse.json(
                { error: 'Failed to delete organization' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete organization error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
