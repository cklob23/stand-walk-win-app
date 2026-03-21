'use client'

import { useCallback } from 'react'
import {
    EmbeddedCheckout,
    EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { startSubscriptionCheckout, type CheckoutParams } from '@/app/actions/stripe'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutProps {
    tierId: string
    journeyId: string
    licenseCount: number
    email: string
    createOrg?: boolean
    orgName?: string
}

export default function Checkout({
    tierId,
    journeyId,
    licenseCount,
    email,
    createOrg,
    orgName
}: CheckoutProps) {
    const fetchClientSecret = useCallback(async () => {
        const result = await startSubscriptionCheckout({
            tierId,
            journeyId,
            licenseCount,
            email,
            createOrg,
            orgName,
        })
        return result.clientSecret || ''
    }, [tierId, journeyId, licenseCount, email, createOrg, orgName])

    return (
        <div id="checkout">
            <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret }}
            >
                <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
        </div>
    )
}
