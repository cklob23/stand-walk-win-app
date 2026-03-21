'use client'

import { useState, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
    EmbeddedCheckout,
    EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { BookOpen, Check, CheckCircle2, Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JOURNEYS, formatPrice } from '@/lib/products'
import { startJourneyPurchase, getCheckoutSession } from '@/app/actions/stripe'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface UserJourney {
    journey_id: string
    status: string
}

interface JourneyStoreProps {
    userId: string
    email: string
    userJourneys: UserJourney[]
    currentJourneyId?: string
}

export function JourneyStore({ userId, email, userJourneys, currentJourneyId }: JourneyStoreProps) {
    const [selectedJourney, setSelectedJourney] = useState<string | null>(null)
    const [showCheckout, setShowCheckout] = useState(false)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [isComplete, setIsComplete] = useState(false)

    const ownedJourneyIds = userJourneys.map(j => j.journey_id)

    const handlePurchase = (journeyId: string) => {
        setSelectedJourney(journeyId)
        setShowCheckout(true)
    }

    const fetchClientSecret = useCallback(async () => {
        if (!selectedJourney) throw new Error('No journey selected')

        const result = await startJourneyPurchase({
            journeyId: selectedJourney,
            email,
            userId,
        })
        setSessionId(result.sessionId)
        return result.clientSecret!
    }, [selectedJourney, email, userId])

    const handleComplete = useCallback(async () => {
        if (!sessionId) return

        try {
            const session = await getCheckoutSession(sessionId)
            if (session.status === 'complete' && session.paymentStatus === 'paid') {
                setIsComplete(true)
            }
        } catch (error) {
            console.error('Error checking session:', error)
        }
    }, [sessionId])

    const selectedJourneyData = JOURNEYS.find(j => j.id === selectedJourney)

    // Purchase complete screen
    if (isComplete && selectedJourneyData) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <CheckCircle2 className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">Journey Unlocked!</CardTitle>
                        <CardDescription>
                            {selectedJourneyData.name} has been added to your account.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            You can start this journey after completing your current one, or switch to it from your dashboard.
                        </p>
                        <Button
                            className="w-full"
                            onClick={() => {
                                setShowCheckout(false)
                                setIsComplete(false)
                                setSelectedJourney(null)
                                window.location.reload()
                            }}
                        >
                            Back to Journeys
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Checkout screen
    if (showCheckout && selectedJourney && selectedJourneyData) {
        return (
            <div className="space-y-6">
                <div>
                    <Button variant="ghost" onClick={() => setShowCheckout(false)} className="gap-2 mb-4">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Journeys
                    </Button>
                    <h1 className="text-2xl font-bold">Purchase Journey</h1>
                    <p className="text-muted-foreground">Complete your purchase for {selectedJourneyData.name}</p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between">
                                <div>
                                    <p className="font-medium">{selectedJourneyData.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedJourneyData.weeks} weeks</p>
                                </div>
                                <span className="font-medium">{formatPrice(selectedJourneyData.priceInCents)}</span>
                            </div>
                            <div className="border-t pt-4">
                                <div className="flex justify-between font-bold">
                                    <span>Total</span>
                                    <span>{formatPrice(selectedJourneyData.priceInCents)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

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
                </div>
            </div>
        )
    }

    // Journey store
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Journey Store</h1>
                <p className="text-muted-foreground">
                    Browse and purchase additional discipleship journeys
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {JOURNEYS.map((journey) => {
                    const isOwned = ownedJourneyIds.includes(journey.id)
                    const isCurrent = currentJourneyId === journey.id
                    const isFree = journey.priceInCents === 0

                    return (
                        <Card key={journey.id} className={isOwned ? 'border-primary/50' : ''}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <BookOpen className="h-5 w-5 text-primary" />
                                    </div>
                                    {isOwned && (
                                        <Badge variant="secondary" className="gap-1">
                                            <Check className="h-3 w-3" />
                                            Owned
                                        </Badge>
                                    )}
                                    {isCurrent && (
                                        <Badge className="gap-1">
                                            Active
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="mt-4">{journey.name}</CardTitle>
                                <CardDescription>{journey.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">{journey.weeks} weeks</span>
                                    <span className="font-semibold">
                                        {isFree ? 'Included' : formatPrice(journey.priceInCents)}
                                    </span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                {isOwned ? (
                                    <Button variant="outline" className="w-full" disabled>
                                        <Check className="mr-2 h-4 w-4" />
                                        Already Owned
                                    </Button>
                                ) : isFree ? (
                                    <Button variant="outline" className="w-full" disabled>
                                        Included with Subscription
                                    </Button>
                                ) : (
                                    <Button className="w-full" onClick={() => handlePurchase(journey.id)}>
                                        Purchase Journey
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
