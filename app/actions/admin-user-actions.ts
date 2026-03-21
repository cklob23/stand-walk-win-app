'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { revalidatePath } from 'next/cache'

export async function deleteUserAndAssociations(userId: string) {
    // Verify master admin access
    const adminData = await getAdminUser()
    if (!adminData?.isMasterAdmin) {
        return { error: 'Unauthorized - Master admin access required' }
    }

    // Don't allow deleting yourself
    if (adminData.user.id === userId) {
        return { error: 'Cannot delete your own account' }
    }

    const supabase = createAdminClient()

    try {
        // Delete in order of dependencies (child records first)

        // 1. Delete assignment reactions (references assignment_progress which references user)
        const { error: assignmentReactionsError } = await supabase
            .from('assignment_reactions')
            .delete()
            .eq('user_id', userId)
        if (assignmentReactionsError) console.error('Error deleting assignment_reactions:', assignmentReactionsError)

        // 2. Delete assignment progress
        const { error: assignmentProgressError } = await supabase
            .from('assignment_progress')
            .delete()
            .or(`user_id.eq.${userId},leader_reply_user_id.eq.${userId}`)
        if (assignmentProgressError) console.error('Error deleting assignment_progress:', assignmentProgressError)

        // 3. Delete journal attachments
        const { error: journalAttachmentsError } = await supabase
            .from('journal_attachments')
            .delete()
            .eq('user_id', userId)
        if (journalAttachmentsError) console.error('Error deleting journal_attachments:', journalAttachmentsError)

        // 4. Delete journal reactions
        const { error: journalReactionsError } = await supabase
            .from('journal_reactions')
            .delete()
            .eq('user_id', userId)
        if (journalReactionsError) console.error('Error deleting journal_reactions:', journalReactionsError)

        // 5. Delete message reactions
        const { error: messageReactionsError } = await supabase
            .from('message_reactions')
            .delete()
            .eq('user_id', userId)
        if (messageReactionsError) console.error('Error deleting message_reactions:', messageReactionsError)

        // 6. Delete messages
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('sender_id', userId)
        if (messagesError) console.error('Error deleting messages:', messagesError)

        // 7. Delete notifications
        const { error: notificationsError } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId)
        if (notificationsError) console.error('Error deleting notifications:', notificationsError)

        // 8. Delete prayer journal entries
        const { error: prayerJournalError } = await supabase
            .from('prayer_journal')
            .delete()
            .or(`user_id.eq.${userId},partner_reply_sender_id.eq.${userId}`)
        if (prayerJournalError) console.error('Error deleting prayer_journal:', prayerJournalError)

        // 9. Delete reflections
        const { error: reflectionsError } = await supabase
            .from('reflections')
            .delete()
            .eq('user_id', userId)
        if (reflectionsError) console.error('Error deleting reflections:', reflectionsError)

        // 10. Delete bible highlights
        const { error: highlightsError } = await supabase
            .from('bible_highlights')
            .delete()
            .eq('user_id', userId)
        if (highlightsError) console.error('Error deleting bible_highlights:', highlightsError)

        // 11. Delete shared items
        const { error: sharedItemsError } = await supabase
            .from('shared_items')
            .delete()
            .or(`sender_id.eq.${userId},recipient_id.eq.${userId},reply_sender_id.eq.${userId}`)
        if (sharedItemsError) console.error('Error deleting shared_items:', sharedItemsError)

        // 12. Delete availability slots
        const { error: availabilityError } = await supabase
            .from('availability_slots')
            .delete()
            .eq('user_id', userId)
        if (availabilityError) console.error('Error deleting availability_slots:', availabilityError)

        // 13. Delete scheduled meetings
        const { error: meetingsError } = await supabase
            .from('scheduled_meetings')
            .delete()
            .or(`scheduled_by.eq.${userId},proposed_by.eq.${userId}`)
        if (meetingsError) console.error('Error deleting scheduled_meetings:', meetingsError)

        // 14. Delete user journeys
        const { error: userJourneysError } = await supabase
            .from('user_journeys')
            .delete()
            .eq('user_id', userId)
        if (userJourneysError) console.error('Error deleting user_journeys:', userJourneysError)

        // 15. Delete user journey purchases
        const { error: purchasesError } = await supabase
            .from('user_journey_purchases')
            .delete()
            .or(`user_id.eq.${userId},granted_by.eq.${userId}`)
        if (purchasesError) console.error('Error deleting user_journey_purchases:', purchasesError)

        // 16. Delete push subscriptions
        const { error: pushSubsError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
        if (pushSubsError) console.error('Error deleting push_subscriptions:', pushSubsError)

        // 17. Delete subscription changes
        const { error: subChangesError } = await supabase
            .from('subscription_changes')
            .delete()
            .or(`user_id.eq.${userId},changed_by.eq.${userId}`)
        if (subChangesError) console.error('Error deleting subscription_changes:', subChangesError)

        // 18. Delete pairings (where user is leader or learner)
        const { error: pairingsError } = await supabase
            .from('pairings')
            .delete()
            .or(`leader_id.eq.${userId},learner_id.eq.${userId}`)
        if (pairingsError) console.error('Error deleting pairings:', pairingsError)

        // 19. Reset access codes that were claimed by this user
        const { error: accessCodesError } = await supabase
            .from('access_codes')
            .update({
                claimed_by: null,
                claimed_at: null,
                status: 'available'
            })
            .eq('claimed_by', userId)
        if (accessCodesError) console.error('Error resetting access_codes:', accessCodesError)

        // 20. Delete organization memberships
        const { error: orgMembersError } = await supabase
            .from('organization_members')
            .delete()
            .or(`user_id.eq.${userId},added_by.eq.${userId}`)
        if (orgMembersError) console.error('Error deleting organization_members:', orgMembersError)

        // 21. Transfer organization ownership if user owns any orgs
        // First, find orgs owned by this user and either transfer to another admin or delete
        const { data: ownedOrgs } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)

        if (ownedOrgs && ownedOrgs.length > 0) {
            // For now, just remove the owner_id (org becomes unowned)
            // Could be enhanced to transfer to another org admin
            const { error: orgOwnerError } = await supabase
                .from('organizations')
                .update({ owner_id: null })
                .eq('owner_id', userId)
            if (orgOwnerError) console.error('Error updating organization owner:', orgOwnerError)
        }

        // 22. Finally, delete the profile
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId)
        if (profileError) {
            console.error('Error deleting profile:', profileError)
            return { error: `Failed to delete profile: ${profileError.message}` }
        }

        // 23. Delete the auth user (using admin client)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)
        if (authError) {
            console.error('Error deleting auth user:', authError)
            // Profile is already deleted, so this is a partial success
            return { error: `Profile deleted but auth user could not be removed: ${authError.message}` }
        }

        // Revalidate the users page
        revalidatePath('/admin/dashboard/users')

        return { success: true }
    } catch (error) {
        console.error('Error in deleteUserAndAssociations:', error)
        return { error: 'An unexpected error occurred while deleting user' }
    }
}
