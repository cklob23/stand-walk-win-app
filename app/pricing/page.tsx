import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PricingContent } from '@/components/pricing/pricing-content'

export const metadata: Metadata = {
    title: 'Pricing | Stand Walk Run',
    description: 'Choose a plan to start your discipleship journey',
}

interface UserData {
    id: string
    email: string
    fullName: string | null
    hasSubscription: boolean
    organizationId: string | null
    organizationName: string | null
}

async function getUserData(): Promise<UserData | null> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get profile with subscription info
    const { data: profile } = await supabase
        .from('profiles')
        .select(`
      id,
      full_name,
      subscription_tier_id,
      organization_id,
      organization:organizations(name)
    `)
        .eq('id', user.id)
        .single()

    if (!profile) return null

    // Check if they have an active subscription
    // Build the filter based on what we have
    let subscriptionQuery = supabase
        .from('subscriptions')
        .select('id')
        .eq('status', 'active')
        .limit(1)

    if (profile.organization_id) {
        subscriptionQuery = subscriptionQuery.or(`purchaser_id.eq.${user.id},organization_id.eq.${profile.organization_id}`)
    } else {
        subscriptionQuery = subscriptionQuery.eq('purchaser_id', user.id)
    }

    const { data: subscriptions } = await subscriptionQuery

    // Supabase joins return arrays, extract first element
    const orgArray = profile.organization as unknown as { name: string }[] | null
    const orgData = orgArray && orgArray.length > 0 ? orgArray[0] : null

    return {
        id: user.id,
        email: user.email || '',
        fullName: profile.full_name,
        hasSubscription: (subscriptions && subscriptions.length > 0) || !!profile.subscription_tier_id,
        organizationId: profile.organization_id,
        organizationName: orgData?.name || null,
    }
}

export default async function PricingPage() {
    const userData = await getUserData()

    return <PricingContent userData={userData} />
}
