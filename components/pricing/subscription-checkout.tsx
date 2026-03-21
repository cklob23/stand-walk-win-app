'use client'

import { useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
    EmbeddedCheckout,
    EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { startSubscriptionCheckout, getCheckoutSession } from '@/app/actions/stripe'
import { getTierById, getJourneyById, formatPrice } from '@/lib/products'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface SubscriptionCheckoutProps {
    tierId: string
    journeyId: string
    licenseCount: number
    email: string
    createOrg: boolean
    orgName: string
    onBack: () => void
}

export function SubscriptionCheckout({
    tierId,
    journeyId,
    licenseCount,
    email,
    createOrg,
    orgName,
    onBack,
}: SubscriptionCheckoutProps) {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(false)
    const sessionIdRef = useRef<string | null>(null)

    const tier = getTierById(tierId)
    const journey = getJourneyById(journeyId)

    const fetchClientSecret = useCallback(async () => {
        console.log('[v0] Starting subscription checkout...')
        const result = await startSubscriptionCheckout({
            tierId,
            journeyId,
            licenseCount,
            email,
            createOrg,
            orgName,
        })
        console.log('[v0] Checkout session created:', result.sessionId)
        sessionIdRef.current = result.sessionId
        return result.clientSecret!
    }, [tierId, journeyId, licenseCount, email, createOrg, orgName])

    const handleComplete = useCallback(async () => {
        const currentSessionId = sessionIdRef.current
        console.log('[v0] handleComplete called, sessionId:', currentSessionId)
        if (!currentSessionId) {
            console.log('[v0] No sessionId, skipping')
            return
        }

        setIsChecking(true)
        try {
            console.log('[v0] Getting checkout session status...')
            const session = await getCheckoutSession(currentSessionId)
            console.log('[v0] Session status:', session.status, 'paymentStatus:', session.paymentStatus)
            if (session.status === 'complete' && session.paymentStatus === 'paid') {
                // Redirect to success page with details
                const params = new URLSearchParams({
                    licenses: licenseCount.toString(),
                    tier: tier?.name || tierId,
                    org: createOrg ? 'true' : 'false',
                })
                console.log('[v0] Redirecting to success page...')
                router.push(`/pricing/success?${params.toString()}`)
            }
        } catch (error) {
            console.error('[v0] Error checking session:', error)
        } finally {
            setIsChecking(false)
        }
    }, [licenseCount, tier?.name, tierId, createOrg, router])

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-4">
                    <Button variant="ghost" onClick={onBack} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Plans
                    </Button>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
                    {/* Order Summary */}
                    <div>
                        <h2 className="mb-4 text-2xl font-bold">Order Summary</h2>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between">
                                        <div>
                                            <p className="font-medium">{tier?.name} Plan</p>
                                            <p className="text-sm text-muted-foreground">
                                                {licenseCount} license{licenseCount > 1 ? 's' : ''} × {formatPrice(tier?.priceInCents || 0)}/mo
                                            </p>
                                        </div>
                                        <span className="font-medium">
                                            {formatPrice((tier?.priceInCents || 0) * licenseCount)}/mo
                                        </span>
                                    </div>

                                    {journey && journey.priceInCents > 0 && (
                                        <div className="flex justify-between">
                                            <div>
                                                <p className="font-medium">{journey.name} Journey</p>
                                                <p className="text-sm text-muted-foreground">One-time purchase</p>
                                            </div>
                                            <span className="font-medium">
                                                {formatPrice(journey.priceInCents * licenseCount)}
                                            </span>
                                        </div>
                                    )}

                                    {journey && journey.priceInCents === 0 && (
                                        <div className="flex justify-between text-muted-foreground">
                                            <div>
                                                <p className="font-medium">{journey.name} Journey</p>
                                                <p className="text-sm">Included with subscription</p>
                                            </div>
                                            <span>Free</span>
                                        </div>
                                    )}

                                    {createOrg && orgName && (
                                        <div className="rounded-lg bg-muted/50 p-3">
                                            <p className="text-sm font-medium">Organization: {orgName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                All {licenseCount} access codes will be linked to this org
                                            </p>
                                        </div>
                                    )}

                                    <div className="border-t pt-4">
                                        <div className="flex justify-between text-lg font-bold">
                                            <span>Total</span>
                                            <span>
                                                {formatPrice(
                                                    ((tier?.priceInCents || 0) * licenseCount) +
                                                    ((journey?.priceInCents || 0) * licenseCount)
                                                )}
                                                {journey && journey.priceInCents === 0 ? '/mo' : ' first month'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Then {formatPrice((tier?.priceInCents || 0) * licenseCount)}/mo
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="mt-4 rounded-lg bg-primary/5 p-4">
                            <h3 className="font-medium text-primary">What happens next?</h3>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                <li>1. Complete your payment below</li>
                                <li>2. Receive your access code{licenseCount > 1 ? 's' : ''} via email</li>
                                <li>3. Use the code{licenseCount > 1 ? 's' : ''} to complete signup</li>
                                {createOrg && <li>4. Manage your organization from the admin dashboard</li>}
                            </ul>
                        </div>
                    </div>

                    {/* Stripe Checkout */}
                    <div>
                        <h2 className="mb-4 text-2xl font-bold">Payment</h2>
                        <Card>
                            <CardContent className="p-0">
                                <EmbeddedCheckoutProvider
                                    stripe={stripePromise}
                                    options={{
                                        fetchClientSecret,
                                        onComplete: handleComplete,
                                    }}
                                >
                                    <EmbeddedCheckout className="min-h-[400px]" />
                                </EmbeddedCheckoutProvider>
                            </CardContent>
                        </Card>

                        {isChecking && (
                            <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Verifying payment...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
