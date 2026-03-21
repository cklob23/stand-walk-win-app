'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, Users, BookOpen, ArrowRight, Sparkles, Check } from 'lucide-react'
import { graduateToLeader, getAvailableJourneys, startNewJourney } from '@/lib/graduation-actions'
import { SubscriptionTier } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'

// Extended journey type with status flags from getAvailableJourneys
interface AvailableJourney {
    id: string
    name: string
    description: string | null
    total_weeks: number
    is_default: boolean
    price: number
    isCompleted: boolean
    isPurchased: boolean
    canStart: boolean
}

interface GraduationModalProps {
    isOpen: boolean
    onClose: () => void
    userId: string
    userName: string
    pairingId: string
    journeyName?: string
    canBeLeader?: boolean
    subscriptionTier?: SubscriptionTier | null
}

export function GraduationModal({
    isOpen,
    onClose,
    userId,
    userName,
    pairingId,
    journeyName = 'Stand Walk Run',
    canBeLeader = true,
    subscriptionTier,
}: GraduationModalProps) {
    const router = useRouter()
    const [step, setStep] = useState<'celebration' | 'choice'>('celebration')
    const [isLoading, setIsLoading] = useState(false)
    const [availableJourneys, setAvailableJourneys] = useState<AvailableJourney[]>([])
    const [loadingJourneys, setLoadingJourneys] = useState(false)

    useEffect(() => {
        if (isOpen && step === 'choice') {
            loadJourneys()
        }
    }, [isOpen, step])

    const loadJourneys = async () => {
        setLoadingJourneys(true)
        const result = await getAvailableJourneys(userId)
        if (result.success && result.journeys) {
            setAvailableJourneys(result.journeys)
        }
        setLoadingJourneys(false)
    }

    const handleGraduateToLeader = async () => {
        setIsLoading(true)
        const result = await graduateToLeader(pairingId)
        setIsLoading(false)

        if (result.success) {
            onClose()
            router.push('/dashboard?graduated=true')
            router.refresh()
        } else {
            alert(result.error || 'Failed to graduate. Please try again.')
        }
    }

    const handleStartNewJourney = async (journeyId: string) => {
        setIsLoading(true)
        const result = await startNewJourney(pairingId, journeyId)
        setIsLoading(false)

        if (result.success) {
            onClose()
            router.push('/dashboard?newJourney=true')
            router.refresh()
        } else {
            alert(result.error || 'Failed to start new journey. Please try again.')
        }
    }

    const maxLearners = subscriptionTier?.max_learners || 1

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                {step === 'celebration' ? (
                    <>
                        <DialogHeader className="text-center pb-4">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                <GraduationCap className="h-8 w-8 text-primary" />
                            </div>
                            <DialogTitle className="text-2xl">Congratulations, {userName}!</DialogTitle>
                            <DialogDescription className="text-base mt-2">
                                You have completed the <span className="font-semibold text-foreground">{journeyName}</span> journey!
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="rounded-lg border bg-success/5 border-success/20 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20">
                                        <Check className="h-5 w-5 text-success" />
                                    </div>
                                    <div>
                                        <p className="font-medium">Journey Complete</p>
                                        <p className="text-sm text-muted-foreground">
                                            You've completed all 6 weeks of assignments and growth
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-center text-muted-foreground">
                                You now have new opportunities to continue your discipleship journey.
                            </p>
                        </div>

                        <div className="flex justify-center pt-2">
                            <Button onClick={() => setStep('choice')} size="lg">
                                <Sparkles className="mr-2 h-4 w-4" />
                                See My Options
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>What's Next?</DialogTitle>
                            <DialogDescription>
                                Choose how you'd like to continue your discipleship journey
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4 sm:grid-cols-2">
                            {/* Graduate to Leader Option */}
                            <Card
                                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${!canBeLeader ? 'opacity-60' : ''}`}
                                onClick={() => canBeLeader && handleGraduateToLeader()}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <Users className="h-5 w-5 text-primary" />
                                        </div>
                                        {canBeLeader && (
                                            <Badge variant="secondary">Recommended</Badge>
                                        )}
                                    </div>
                                    <CardTitle className="text-lg mt-3">Become a Leader</CardTitle>
                                    <CardDescription>
                                        Guide others through their discipleship journey
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-success" />
                                            Mentor up to {maxLearners} learner{maxLearners > 1 ? 's' : ''}
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-success" />
                                            Share your experience and wisdom
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-success" />
                                            Grow through teaching others
                                        </li>
                                    </ul>
                                    {!canBeLeader && (
                                        <p className="mt-3 text-xs text-destructive">
                                            Your subscription tier doesn't include leader capabilities.
                                            Contact support to upgrade.
                                        </p>
                                    )}
                                    {canBeLeader && (
                                        <Button className="w-full mt-4" disabled={isLoading}>
                                            {isLoading ? <Spinner className="mr-2" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                            Graduate to Leader
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Start New Journey Option */}
                            <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
                                <CardHeader className="pb-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                        <BookOpen className="h-5 w-5 text-secondary-foreground" />
                                    </div>
                                    <CardTitle className="text-lg mt-3">Start Another Journey</CardTitle>
                                    <CardDescription>
                                        Continue growing with a new module
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    {loadingJourneys ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Spinner />
                                        </div>
                                    ) : availableJourneys.length > 0 ? (
                                        <div className="space-y-2">
                                            {availableJourneys.slice(0, 3).map((journey) => (
                                                <button
                                                    key={journey.id}
                                                    onClick={() => handleStartNewJourney(journey.id)}
                                                    disabled={isLoading}
                                                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{journey.name}</span>
                                                        {journey.price > 0 ? (
                                                            <Badge variant="outline">${journey.price}</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Free</Badge>
                                                        )}
                                                    </div>
                                                    {journey.description && (
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                            {journey.description}
                                                        </p>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-sm text-muted-foreground">
                                            <p>No additional journeys available yet.</p>
                                            <p className="mt-1">Check back later for new content!</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                            <Button variant="ghost" onClick={() => setStep('celebration')}>
                                Back
                            </Button>
                            <Button variant="outline" onClick={onClose}>
                                Decide Later
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
