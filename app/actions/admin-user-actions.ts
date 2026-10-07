'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { generateUniqueAccessCode } from '@/lib/access-codes'
import { sendLeaderInviteEmail, type AccessCodeWithPlan } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

export type UserFormOptions = {
    organizations: { id: string; name: string }[]
    tiers: { id: string; name: string; display_name: string }[]
    journeys: { id: string; name: string }[]
}

export type CreateLeaderInput = {
    fullName: string
    email: string
    organizationId?: string | null
    tierId: string
    journeyId: string
    licenseCount?: number
}

export type UpdateUserInput = {
    userId: string
    fullName: string
    email: string
    role: 'leader' | 'learner' | null
    adminRole: 'master_admin' | 'org_admin' | null
    organizationId?: string | null
    subscriptionTierId?: string | null
}

async function requireMasterAdmin() {
    const adminData = await getAdminUser()
    if (!adminData?.isMasterAdmin) {
        return { error: 'Unauthorized - Master admin access required' as const, adminData: null }
    }
    return { error: null, adminData }
}

export async function getUserFormOptions(): Promise<{
    success?: boolean
    options?: UserFormOptions
    error?: string
}> {
    const { error } = await requireMasterAdmin()
    if (error) return { error }

    const supabase = createAdminClient()

    const [{ data: organizations }, { data: tiers }, { data: journeys }] = await Promise.all([
        supabase.from('organizations').select('id, name').order('name', { ascending: true }),
        supabase
            .from('subscription_tiers')
            .select('id, name, display_name')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
        supabase
            .from('journeys')
            .select('id, name')
            .order('name', { ascending: true }),
    ])

    return {
        success: true,
        options: {
            organizations: organizations || [],
            tiers: tiers || [],
            journeys: journeys || [],
        },
    }
}

async function waitForProfile(supabase: ReturnType<typeof createAdminClient>, userId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()

        if (data && !error) return true
        await new Promise(resolve => setTimeout(resolve, 400))
    }
    return false
}

export async function createLeaderAccount(input: CreateLeaderInput) {
    const { error: authError, adminData } = await requireMasterAdmin()
    if (authError || !adminData) return { error: authError || 'Unauthorized' }

    const fullName = input.fullName.trim()
    const email = input.email.trim().toLowerCase()
    const organizationId = input.organizationId || null
    const licenseCount = Math.min(Math.max(input.licenseCount || 1, 1), 10)

    if (!fullName || !email) {
        return { error: 'Name and email are required' }
    }
    if (!input.tierId || !input.journeyId) {
        return { error: 'Plan and journey are required' }
    }

    const supabase = createAdminClient()

    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()

    if (existingProfile) {
        return { error: 'A user with this email already exists' }
    }

    const { data: tier } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name')
        .eq('id', input.tierId)
        .single()

    const { data: journey } = await supabase
        .from('journeys')
        .select('id, name')
        .eq('id', input.journeyId)
        .single()

    if (!tier || !journey) {
        return { error: 'Selected plan or journey was not found' }
    }

    let orgName: string | null = null
    if (organizationId) {
        const { data: org } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('id', organizationId)
            .single()
        if (!org) {
            return { error: 'Selected organization was not found' }
        }
        orgName = org.name
    }

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: randomBytes(24).toString('base64url'),
        email_confirm: true,
        user_metadata: { full_name: fullName },
    })

    if (createError || !authData.user) {
        if (createError?.message?.toLowerCase().includes('already')) {
            return { error: 'A user with this email already exists' }
        }
        return { error: createError?.message || 'Failed to create leader account' }
    }

    const userId = authData.user.id
    await waitForProfile(supabase, userId)

    const profileUpdate: Record<string, unknown> = {
        full_name: fullName,
        email,
        role: 'leader',
        can_be_leader: true,
        subscription_tier_id: input.tierId,
        organization_id: organizationId,
        updated_at: new Date().toISOString(),
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId)

    if (profileError) {
        console.error('Error updating new leader profile:', profileError)
        return { error: `Account was created but profile could not be updated: ${profileError.message}` }
    }

    if (organizationId) {
        await supabase
            .from('organization_members')
            .upsert({
                organization_id: organizationId,
                user_id: userId,
                role: 'member',
                added_by: adminData.user.id,
            }, { onConflict: 'organization_id,user_id' })
    }

    const { error: journeyError } = await supabase
        .from('user_journeys')
        .upsert({
            user_id: userId,
            journey_id: input.journeyId,
            status: 'active',
        }, { onConflict: 'user_id,journey_id' })
    if (journeyError) {
        console.error('Error assigning journey to new leader:', journeyError)
    }

    const { data: existingPurchase } = await supabase
        .from('user_journey_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('journey_id', input.journeyId)
        .maybeSingle()

    if (!existingPurchase) {
        await supabase
            .from('user_journey_purchases')
            .insert({
                user_id: userId,
                journey_id: input.journeyId,
                granted_by: adminData.user.id,
                notes: 'Granted by master admin when creating leader',
            })
    }

    const createdCodes: AccessCodeWithPlan[] = []
    let firstCodeId: string | null = null

    for (let i = 0; i < licenseCount; i++) {
        const code = await generateUniqueAccessCode(supabase)
        if (!code) {
            console.error('Failed to generate unique access code')
            continue
        }

        const isFirst = i === 0
        const { data: inserted, error: codeError } = await supabase
            .from('access_codes')
            .insert({
                code,
                organization_id: organizationId,
                tier_id: input.tierId,
                journey_id: input.journeyId,
                status: isFirst ? 'claimed' : 'available',
                claimed_by: isFirst ? userId : null,
                claimed_at: isFirst ? new Date().toISOString() : null,
            })
            .select('id, code')
            .single()

        if (codeError || !inserted) {
            console.error('Error creating access code:', codeError)
            continue
        }

        if (isFirst) {
            firstCodeId = inserted.id
        }

        createdCodes.push({
            code: inserted.code,
            tierName: tier.display_name || tier.name,
            journeyName: journey.name,
        })
    }

    if (createdCodes.length === 0) {
        return { error: 'Leader was created but access codes could not be generated' }
    }

    if (firstCodeId) {
        await supabase
            .from('profiles')
            .update({ access_code_id: firstCodeId })
            .eq('id', userId)
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://standwalkrun.com'
    let setupUrl: string | null = null
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
            redirectTo: `${appUrl}/auth/callback?next=/auth/reset-password`,
        },
    })

    if (linkError) {
        console.error('Error generating password setup link:', linkError)
    } else {
        setupUrl = linkData?.properties?.action_link || null
    }

    const emailResult = await sendLeaderInviteEmail({
        email,
        fullName,
        codes: createdCodes,
        setupUrl,
        orgName,
    })

    revalidatePath('/admin/dashboard/users')

    if (!emailResult.success) {
        return {
            success: true,
            warning: 'Leader was created, but the invite email could not be sent. You can share the access codes manually.',
            codes: createdCodes.map(code => code.code),
        }
    }

    return {
        success: true,
        codes: createdCodes.map(code => code.code),
    }
}

export async function updateUserRecord(input: UpdateUserInput) {
    const { error: authError, adminData } = await requireMasterAdmin()
    if (authError || !adminData) return { error: authError || 'Unauthorized' }

    const fullName = input.fullName.trim()
    const email = input.email.trim().toLowerCase()

    if (!input.userId) {
        return { error: 'User is required' }
    }
    if (!fullName || !email) {
        return { error: 'Name and email are required' }
    }
    if (input.adminRole === 'org_admin' && !input.organizationId) {
        return { error: 'Organization is required for an org admin' }
    }
    if (adminData.user.id === input.userId && input.adminRole !== 'master_admin') {
        return { error: 'You cannot remove your own master admin role' }
    }

    const supabase = createAdminClient()

    const { data: currentProfile, error: currentError } = await supabase
        .from('profiles')
        .select('id, email, organization_id, admin_role')
        .eq('id', input.userId)
        .single()

    if (currentError || !currentProfile) {
        return { error: 'User not found' }
    }

    if (email !== (currentProfile.email || '').toLowerCase()) {
        const { data: emailOwner } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .neq('id', input.userId)
            .maybeSingle()

        if (emailOwner) {
            return { error: 'Another user already has this email' }
        }

        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(input.userId, {
            email,
            user_metadata: { full_name: fullName },
        })
        if (authUpdateError) {
            return { error: `Failed to update login email: ${authUpdateError.message}` }
        }
    } else {
        await supabase.auth.admin.updateUserById(input.userId, {
            user_metadata: { full_name: fullName },
        })
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            full_name: fullName,
            email,
            role: input.role,
            admin_role: input.adminRole,
            is_admin: input.adminRole !== null,
            organization_id: input.organizationId || null,
            subscription_tier_id: input.subscriptionTierId || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', input.userId)

    if (profileError) {
        console.error('Error updating user profile:', profileError)
        return { error: `Failed to update user: ${profileError.message}` }
    }

    const previousOrgId = currentProfile.organization_id || null
    const nextOrgId = input.organizationId || null

    if (previousOrgId && previousOrgId !== nextOrgId) {
        await supabase
            .from('organization_members')
            .delete()
            .eq('organization_id', previousOrgId)
            .eq('user_id', input.userId)
    }

    if (nextOrgId && nextOrgId !== previousOrgId) {
        await supabase
            .from('organization_members')
            .upsert({
                organization_id: nextOrgId,
                user_id: input.userId,
                role: input.adminRole === 'org_admin' ? 'admin' : 'member',
                added_by: adminData.user.id,
            }, { onConflict: 'organization_id,user_id' })
    }

    revalidatePath('/admin/dashboard/users')
    return { success: true }
}

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
