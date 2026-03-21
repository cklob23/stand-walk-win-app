'use server'

import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin-auth-actions'
import { redirect } from 'next/navigation'

export async function createBillingPortalSession() {
    const adminData = await getAdminUser()

    if (!adminData || !adminData.organization) {
        return { error: 'Not authorized' }
    }

    const supabase = createAdminClient()

    // Get subscription with Stripe customer ID
    const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id, stripe_subscription_id')
        .eq('organization_id', adminData.organization.id)
        .single()

    if (!subscription?.stripe_customer_id) {
        return { error: 'No Stripe customer found for this subscription' }
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/dashboard/subscription`,
        })

        return { url: session.url }
    } catch (error) {
        console.error('Error creating billing portal session:', error)
        return { error: 'Failed to create billing portal session' }
    }
}

export async function redirectToBillingPortal(): Promise<void> {
    const result = await createBillingPortalSession()

    if (result.url) {
        redirect(result.url)
    }

    // If no URL, redirect back to subscription page
    redirect('/admin/dashboard/subscription')
}
