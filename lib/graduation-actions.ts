'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { USER_JOURNEY_ON_CONFLICT, buildCompletedUserJourneyRow } from '@/lib/journey-graduation'

export async function graduateToLeader(pairingId: string) {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify the user is the learner of this pairing
    const { data: pairing } = await supabase
        .from('pairings')
        .select('*, journey:journeys(*)')
        .eq('id', pairingId)
        .eq('learner_id', user.id)
        .single()

    if (!pairing) {
        return { success: false, error: 'Pairing not found' }
    }

    if (!pairing.journey_id) {
        return { success: false, error: 'Pairing is missing a journey' }
    }

    // Get the user's current profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*, subscription_tier:subscription_tiers(*)')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return { success: false, error: 'Profile not found' }
    }

    const completedAt = new Date().toISOString()

    // Update the pairing status to completed (admin client — RLS)
    const { error: pairingError } = await admin
        .from('pairings')
        .update({
            status: 'completed',
            completed_at: completedAt
        })
        .eq('id', pairingId)
        .eq('learner_id', user.id)

    if (pairingError) {
        return { success: false, error: 'Failed to complete pairing' }
    }

    // Same conflict key and shape as app/actions/admin-user-actions.ts
    const { error: journeyError } = await admin
        .from('user_journeys')
        .upsert(
            buildCompletedUserJourneyRow({
                userId: user.id,
                journeyId: pairing.journey_id,
                pairingId,
                completedAt,
            }),
            { onConflict: USER_JOURNEY_ON_CONFLICT },
        )

    if (journeyError) {
        console.error('Failed to record journey completion:', journeyError)
        return { success: false, error: 'Failed to record journey completion' }
    }

    // Update the user's profile to be a leader
    const { error: profileError } = await admin
        .from('profiles')
        .update({
            role: 'leader',
            can_be_leader: true,
            graduated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (profileError) {
        return { success: false, error: 'Failed to update profile' }
    }

    revalidatePath('/dashboard')
    return { success: true }
}

export async function startNewJourney(pairingId: string, journeyId: string) {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Not authenticated' }
    }

    // Verify the user is the learner of this pairing
    const { data: pairing } = await supabase
        .from('pairings')
        .select('*')
        .eq('id', pairingId)
        .eq('learner_id', user.id)
        .single()

    if (!pairing) {
        return { success: false, error: 'Pairing not found' }
    }

    // Check if user has purchased/has access to this journey
    const { data: purchase } = await supabase
        .from('user_journey_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('journey_id', journeyId)
        .single()

    // Check if it's the default journey (free)
    const { data: journey } = await supabase
        .from('journeys')
        .select('*')
        .eq('id', journeyId)
        .single()

    if (!journey) {
        return { success: false, error: 'Journey not found' }
    }

    // If not free and no purchase, they need to buy it
    if (journey.price > 0 && !purchase) {
        return { success: false, error: 'Journey not purchased', needsPurchase: true }
    }

    // Complete the current pairing
    const completedAt = new Date().toISOString()
    const { error: completeError } = await admin
        .from('pairings')
        .update({
            status: 'completed',
            completed_at: completedAt
        })
        .eq('id', pairingId)
        .eq('learner_id', user.id)

    if (completeError) {
        return { success: false, error: 'Failed to complete current pairing' }
    }

    if (pairing.journey_id) {
        const { error: completedJourneyError } = await admin
            .from('user_journeys')
            .upsert(
                buildCompletedUserJourneyRow({
                    userId: user.id,
                    journeyId: pairing.journey_id,
                    pairingId,
                    completedAt,
                }),
                { onConflict: USER_JOURNEY_ON_CONFLICT },
            )

        if (completedJourneyError) {
            console.error('Failed to record journey completion:', completedJourneyError)
            return { success: false, error: 'Failed to record journey completion' }
        }
    }

    // The user will need to be paired again with a leader for the new journey
    // For now, just record the intent to start a new journey
    const { error: newJourneyError } = await admin
        .from('user_journeys')
        .upsert({
            user_id: user.id,
            journey_id: journeyId,
            status: 'paused', // Paused until they get a new leader
            completion_percentage: 0
        }, {
            onConflict: USER_JOURNEY_ON_CONFLICT,
        })

    if (newJourneyError) {
        console.error('Failed to record new journey intent:', newJourneyError)
        return { success: false, error: 'Failed to start new journey' }
    }

    revalidatePath('/dashboard')
    return { success: true, needsNewPairing: true }
}

export async function getAvailableJourneys(userId: string, currentJourneyId?: string): Promise<{ success: boolean; journeys: Array<{ id: string; name: string; description: string | null; total_weeks: number; is_default: boolean; price: number; isCompleted: boolean; isPurchased: boolean; canStart: boolean }> }> {
    const supabase = await createClient()

    // Get all available journeys
    const { data: journeys, error } = await supabase
        .from('journeys')
        .select('*')
        .eq('is_available', true)
        .order('is_default', { ascending: false })
        .order('name')

    if (error || !journeys) {
        return { success: false, journeys: [] }
    }

    // Get user's completed journeys
    const { data: completedJourneys } = await supabase
        .from('user_journeys')
        .select('journey_id')
        .eq('user_id', userId)
        .eq('status', 'completed')

    const completedIds = new Set(completedJourneys?.map(j => j.journey_id) || [])

    // Get user's purchased journeys
    const { data: purchases } = await supabase
        .from('user_journey_purchases')
        .select('journey_id')
        .eq('user_id', userId)

    const purchasedIds = new Set(purchases?.map(p => p.journey_id) || [])

    // Filter out current journey and mark journeys with status
    return {
        success: true,
        journeys: journeys
            .filter(journey => journey.id !== currentJourneyId) // Exclude current journey
            .map(journey => ({
                ...journey,
                isCompleted: completedIds.has(journey.id),
                isPurchased: purchasedIds.has(journey.id) || journey.is_default || journey.price === 0,
                canStart: !completedIds.has(journey.id) && (purchasedIds.has(journey.id) || journey.is_default || journey.price === 0)
            }))
    }
}

