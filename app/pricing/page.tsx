import { Metadata } from 'next'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { PricingContent } from '@/components/pricing/pricing-content'

export const metadata: Metadata = {
    title: 'Pricing | Stand Walk Run',
    description: 'Choose a plan to start your discipleship journey',
}

interface UserData {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    hasSubscription: boolean
    organizationId: string | null
    organizationName: string | null
}

async function getUserData(): Promise<UserData | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Use admin client to bypass RLS for organization lookups (same as getAdminUser)
    const adminClient = createAdminClient()

    // Get profile with subscription info
    const { data: profile } = await adminClient
        .from('profiles')
        .select(`
      id,
      full_name,
      avatar_url,
      subscription_tier_id,
      organization_id
    `)
        .eq('id', user.id)
        .single()

    if (!profile) return null

    // First check profile's organization_id
    let organizationId = profile.organization_id
    let organizationName: string | null = null

    // Get organization name if we have an ID
    if (organizationId) {
        const { data: org } = await adminClient
            .from('organizations')
            .select('name')
            .eq('id', organizationId)
            .single()
        if (org) {
            organizationName = org.name
        }
    }

    // If no organization_id on profile, check if user owns an organization (like getAdminUser does)
    if (!organizationId) {
        const { data: ownedOrg } = await adminClient
            .from('organizations')
            .select('id, name')
            .eq('owner_id', user.id)
            .single()

        if (ownedOrg) {
            organizationId = ownedOrg.id
            organizationName = ownedOrg.name
        }
    }

    // Also check if user's email matches organization admin_email
    if (!organizationId && user.email) {
        const { data: orgByEmail } = await adminClient
            .from('organizations')
            .select('id, name')
            .eq('admin_email', user.email)
            .single()

        if (orgByEmail) {
            organizationId = orgByEmail.id
            organizationName = orgByEmail.name
        }
    }

    // Check if they have an active subscription
    let subscriptionQuery = adminClient
        .from('subscriptions')
        .select('id')
        .eq('status', 'active')
        .limit(1)

    if (organizationId) {
        subscriptionQuery = subscriptionQuery.or(`purchaser_id.eq.${user.id},organization_id.eq.${organizationId}`)
    } else {
        subscriptionQuery = subscriptionQuery.eq('purchaser_id', user.id)
    }

    const { data: subscriptions } = await subscriptionQuery

    return {
        id: user.id,
        email: user.email || '',
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        hasSubscription: (subscriptions && subscriptions.length > 0) || !!profile.subscription_tier_id,
        organizationId: organizationId,
        organizationName: organizationName,
    }
}

export default async function PricingPage() {
    const userData = await getUserData()

    return <PricingContent userData={userData} />
}
