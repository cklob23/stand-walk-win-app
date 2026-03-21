'use server'

import { createClient } from '@/lib/supabase/server'
import type { SubscriptionTier } from '@/lib/types'

export interface LearnerLimitCheck {
    canAddLearner: boolean
    currentCount: number
    maxLearners: number
    tier: SubscriptionTier | null
    needsUpgrade: boolean
}

// Check if a leader can add another learner based on their subscription tier
export async function checkLearnerLimit(leaderId: string): Promise<LearnerLimitCheck> {
    const supabase = await createClient()

    // Get the leader's profile with subscription tier
    const { data: profile } = await supabase
        .from('profiles')
        .select(`
      subscription_tier_id,
      subscription_tier:subscription_tiers(*)
    `)
        .eq('id', leaderId)
        .single()

    // subscription_tier comes back as an array from the join, take first element
    const tierData = profile?.subscription_tier
    const tier = (Array.isArray(tierData) ? tierData[0] : tierData) as SubscriptionTier | null
    const maxLearners = tier?.max_learners || 1 // Default to 1 if no tier

    // Count current active pairings where this user is the leader
    // Only count pairings that actually have a learner attached (active pairings)
    // Don't count pending invite codes that haven't been claimed yet
    const { count } = await supabase
        .from('pairings')
        .select('*', { count: 'exact', head: true })
        .eq('leader_id', leaderId)
        .eq('status', 'active')

    const currentCount = count || 0
    const canAddLearner = currentCount < maxLearners

    return {
        canAddLearner,
        currentCount,
        maxLearners,
        tier,
        needsUpgrade: !canAddLearner,
    }
}

// Get user's subscription tier info
export async function getUserSubscriptionInfo(userId: string) {
    const supabase = await createClient()

    const { data: profile } = await supabase
        .from('profiles')
        .select(`
      subscription_tier_id,
      can_be_leader,
      graduated_at,
      subscription_tier:subscription_tiers(*)
    `)
        .eq('id', userId)
        .single()

    const tierData = profile?.subscription_tier
    const tier = (Array.isArray(tierData) ? tierData[0] : tierData) as SubscriptionTier | null

    return {
        tier,
        canBeLeader: profile?.can_be_leader !== false,
        hasGraduated: !!profile?.graduated_at,
    }
}
