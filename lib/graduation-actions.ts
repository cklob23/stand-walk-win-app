'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function graduateToLeader(pairingId: string) {
    const supabase = await createClient()

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

    // Get the user's current profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*, subscription_tier:subscription_tiers(*)')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return { success: false, error: 'Profile not found' }
    }

    // Update the pairing status to completed
    const { error: pairingError } = await supabase
        .from('pairings')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', pairingId)

    if (pairingError) {
        return { success: false, error: 'Failed to complete pairing' }
    }

    // Create user_journey record for the completed journey
    const { error: journeyError } = await supabase
        .from('user_journeys')
        .upsert({
            user_id: user.id,
            journey_id: pairing.journey_id,
            pairing_id: pairingId,
            status: 'completed',
            completed_at: new Date().toISOString(),
            completion_percentage: 100
        }, {
            onConflict: 'user_id,journey_id,pairing_id'
        })

    if (journeyError) {
        console.error('Failed to record journey completion:', journeyError)
    }

    // Update the user's profile to be a leader
    const { error: profileError } = await supabase
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
    const { error: completeError } = await supabase
        .from('pairings')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', pairingId)

    if (completeError) {
        return { success: false, error: 'Failed to complete current pairing' }
    }

    // Record the completed journey
    await supabase
        .from('user_journeys')
        .upsert({
            user_id: user.id,
            journey_id: pairing.journey_id,
            pairing_id: pairingId,
            status: 'completed',
            completed_at: new Date().toISOString(),
            completion_percentage: 100
        }, {
            onConflict: 'user_id,journey_id,pairing_id'
        })

    // The user will need to be paired again with a leader for the new journey
    // For now, just record the intent to start a new journey
    await supabase
        .from('user_journeys')
        .insert({
            user_id: user.id,
            journey_id: journeyId,
            status: 'paused', // Paused until they get a new leader
            completion_percentage: 0
        })

    revalidatePath('/dashboard')
    return { success: true, needsNewPairing: true }
}

export async function getAvailableJourneys(userId: string): Promise<{ success: boolean; journeys: Array<{ id: string; name: string; description: string | null; total_weeks: number; is_default: boolean; price: number; isCompleted: boolean; isPurchased: boolean; canStart: boolean }> }> {
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

    // Mark journeys with status
    return {
        success: true,
        journeys: journeys.map(journey => ({
            ...journey,
            isCompleted: completedIds.has(journey.id),
            isPurchased: purchasedIds.has(journey.id) || journey.is_default || journey.price === 0,
            canStart: !completedIds.has(journey.id) && (purchasedIds.has(journey.id) || journey.is_default || journey.price === 0)
        }))
    }
}

export async function checkJourneyCompletion(pairingId: string, userId: string) {
    const supabase = await createClient()

    // Get the pairing and its journey
    const { data: pairing } = await supabase
        .from('pairings')
        .select('*, journey:journeys(*)')
        .eq('id', pairingId)
        .single()

    if (!pairing) {
        return { isComplete: false }
    }

    const totalWeeks = pairing.journey?.total_weeks || 6

    // Check if user is on the last week and has completed all assignments
    if (pairing.current_week < totalWeeks) {
        return { isComplete: false }
    }

    // Get all assignments for this journey
    const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .lte('week_number', totalWeeks)

    if (!assignments || assignments.length === 0) {
        return { isComplete: false }
    }

    // Get user's completed assignments for this pairing
    const { data: progress } = await supabase
        .from('assignment_progress')
        .select('assignment_id')
        .eq('pairing_id', pairingId)
        .eq('user_id', userId)
        .eq('status', 'completed')

    const completedCount = progress?.length || 0
    const totalCount = assignments.length

    // Consider journey complete if all assignments are done
    const isComplete = completedCount >= totalCount

    return {
        isComplete,
        completedCount,
        totalCount,
        percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    }
}
