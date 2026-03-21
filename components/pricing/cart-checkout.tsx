'use client'

import { useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
    EmbeddedCheckout,
    EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { startCartCheckout, startJourneyCartCheckout, getCheckoutSession } from '@/app/actions/stripe'
import { SUBSCRIPTION_TIERS, JOURNEYS, formatPrice } from '@/lib/products'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CartItem {
    id: string
    tierId: string
    tierName: string
    journeyId: string
    journeyName: string
    priceInCents: number
}

interface JourneyCartItem {
    id: string
    journeyId: string
    journeyName: string
    priceInCents: number
}

interface CartCheckoutProps {
    cart: CartItem[]
    journeyCart?: JourneyCartItem[]
    email: string
    createOrg: boolean
    orgName: string
    userId?: string
    onBack: () => void
}

export function CartCheckout({
    cart,
    journeyCart = [],
    email,
    createOrg,
    orgName,
    userId,
    onBack,
}: CartCheckoutProps) {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(false)
    const sessionIdRef = useRef<string | null>(null)

    // Group cart items by tier for summary
    const cartCountByTier = SUBSCRIPTION_TIERS.map(tier => ({
        tier,
        count: cart.filter(item => item.tierId === tier.id).length,
        items: cart.filter(item => item.tierId === tier.id)
    })).filter(t => t.count > 0)

    const cartTotal = cart.reduce((sum, item) => sum + item.priceInCents, 0)
    const journeyTotal = journeyCart.reduce((sum, item) => sum + item.priceInCents, 0)
    const hasOnlyJourneys = cart.length === 0 && journeyCart.length > 0

    const fetchClientSecret = useCallback(async () => {
        // If only journeys (no plan licenses), use journey-only checkout
        if (hasOnlyJourneys) {
            const result = await startJourneyCartCheckout({
                items: journeyCart.map(item => ({
                    journeyId: item.journeyId,
                })),
                email,
                userId,
            })
            sessionIdRef.current = result.sessionId
            return result.clientSecret!
        }

        // Full cart checkout with plans and optional journeys
        const result = await startCartCheckout({
            items: cart.map(item => ({
                tierId: item.tierId,
                journeyId: item.journeyId,
            })),
            email,
            createOrg,
            orgName,
        })
        sessionIdRef.current = result.sessionId
        return result.clientSecret!
    }, [cart, journeyCart, email, createOrg, orgName, userId, hasOnlyJourneys])

    const handleComplete = useCallback(async () => {
        const currentSessionId = sessionIdRef.current
        if (!currentSessionId) return

        setIsChecking(true)
        try {
            const session = await getCheckoutSession(currentSessionId)
            if (session.status === 'complete' && session.paymentStatus === 'paid') {
                if (hasOnlyJourneys) {
                    // Redirect to journey success
                    router.push(`/pricing/success?type=journeys&count=${journeyCart.length}`)
                } else {
                    const params = new URLSearchParams({
                        licenses: cart.length.toString(),
                        org: createOrg ? 'true' : 'false',
                    })
                    router.push(`/pricing/success?${params.toString()}`)
                }
            }
        } catch (error) {
            console.error('Error checking session:', error)
        } finally {
            setIsChecking(false)
        }
    }, [cart.length, journeyCart.length, createOrg, router, hasOnlyJourneys])

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
                                    {/* Plan Licenses - Group by tier */}
                                    {cartCountByTier.length > 0 && (
                                        <>
                                            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Plan Licenses</h3>
                                            {cartCountByTier.map(({ tier, count, items }) => (
                                                <div key={tier.id}>
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium">{tier.name} Plan</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {count} license{count > 1 ? 's' : ''} x {formatPrice(tier.priceInCents)}/mo
                                                            </p>
                                                        </div>
                                                        <span className="font-medium">
                                                            {formatPrice(tier.priceInCents * count)}/mo
                                                        </span>
                                                    </div>

                                                    {/* Show individual journeys */}
                                                    <div className="mt-2 pl-4 border-l-2 border-muted space-y-1">
                                                        {items.map((item, idx) => (
                                                            <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <BookOpen className="h-3 w-3" />
                                                                <span>License #{idx + 1}: {item.journeyName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {/* Journey Add-ons */}
                                    {journeyCart.length > 0 && (
                                        <>
                                            {cart.length > 0 && <Separator />}
                                            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                                                {hasOnlyJourneys ? 'Journey Purchases' : 'Additional Journeys'}
                                            </h3>
                                            {journeyCart.map((item) => (
                                                <div key={item.id} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="h-4 w-4 text-primary" />
                                                        <span>{item.journeyName}</span>
                                                    </div>
                                                    <span className="font-medium">{formatPrice(item.priceInCents)}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}

                                    {createOrg && orgName && (
                                        <>
                                            <Separator />
                                            <div className="rounded-lg bg-muted/50 p-3">
                                                <p className="text-sm font-medium">Organization: {orgName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    All {cart.length} access codes will be linked to this org
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    <Separator />

                                    <div className="space-y-1">
                                        {cartTotal > 0 && (
                                            <div className="flex justify-between text-lg font-bold">
                                                <span>Monthly Total</span>
                                                <span>{formatPrice(cartTotal)}/mo</span>
                                            </div>
                                        )}
                                        {journeyTotal > 0 && (
                                            <div className="flex justify-between text-lg font-bold">
                                                <span>One-time Total</span>
                                                <span>{formatPrice(journeyTotal)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="mt-4 rounded-lg bg-primary/5 p-4">
                            <h3 className="font-medium text-primary">What happens next?</h3>
                            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {hasOnlyJourneys ? (
                                    <>
                                        <li>1. Complete your payment below</li>
                                        <li>2. Journeys will be added to your account</li>
                                        <li>3. Assign journeys to yourself or org members</li>
                                        <li>4. Members can start new journeys after completing their current one</li>
                                    </>
                                ) : (
                                    <>
                                        <li>1. Complete your payment below</li>
                                        <li>2. Receive {cart.length} access code{cart.length > 1 ? 's' : ''} via email</li>
                                        <li>3. Each code is pre-assigned to its selected journey</li>
                                        <li>4. Distribute codes to your leaders for signup</li>
                                        {createOrg && <li>5. Manage your organization from the admin dashboard</li>}
                                    </>
                                )}
                            </ul>
                        </div>

                        {/* License breakdown */}
                        {cart.length > 0 && (
                            <div className="mt-4">
                                <h3 className="font-medium mb-2">License Breakdown</h3>
                                <div className="space-y-2">
                                    {cart.map((item, index) => (
                                        <div key={item.id} className="flex items-center justify-between text-sm rounded-lg border p-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0 text-xs">
                                                    {index + 1}
                                                </Badge>
                                                <span className="text-muted-foreground">{item.tierName}</span>
                                            </div>
                                            <span className="text-muted-foreground">{item.journeyName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
