'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { GraduationCap, Users, BookOpen, ArrowRight, Sparkles, Check, Building2, ShoppingCart, Send, Archive, Trophy, PartyPopper } from 'lucide-react'
import { graduateToLeader, getAvailableJourneys, startNewJourney } from '@/lib/graduation-actions'
import { submitOrgMemberRequest } from '@/lib/org-request-actions'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'

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
    journeyId?: string // Current journey ID to filter from available journeys
    journeyName?: string
    journeySubtitle?: string // e.g., "New Believer Foundations" - displays after the main name
    canBeLeader?: boolean
    subscriptionTier?: { max_learners: number } | null
    organizationId?: string | null
    organizationName?: string | null
}

export function GraduationModal({
    isOpen,
    onClose,
    userId,
    userName,
    pairingId,
    journeyId,
    journeyName = 'Stand Walk Run',
    journeySubtitle,
    canBeLeader = true,
    subscriptionTier,
    organizationId,
    organizationName,
}: GraduationModalProps) {
    const router = useRouter()
    const [step, setStep] = useState<'celebration' | 'choice' | 'request-leader' | 'request-journey' | 'request-sent'>('celebration')
    const [isLoading, setIsLoading] = useState(false)
    const [availableJourneys, setAvailableJourneys] = useState<AvailableJourney[]>([])
    const [loadingJourneys, setLoadingJourneys] = useState(false)
    const [requestNotes, setRequestNotes] = useState('')
    const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false)

    const isOrgMember = !!organizationId
    const maxLearners = subscriptionTier?.max_learners || 1

    // Trigger confetti on celebration step
    useEffect(() => {
        if (isOpen && step === 'celebration' && !hasTriggeredConfetti) {
            const duration = 3000
            const end = Date.now() + duration
            const colors = ['#0f6353', '#f0ede6', '#fbbf24', '#10b981', '#f59e0b']

            const frame = () => {
                confetti({
                    particleCount: 4,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors,
                })
                confetti({
                    particleCount: 4,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors,
                })

                if (Date.now() < end) {
                    requestAnimationFrame(frame)
                }
            }

            frame()
            setHasTriggeredConfetti(true)
        }
    }, [isOpen, step, hasTriggeredConfetti])

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setHasTriggeredConfetti(false)
            setStep('celebration')
            setRequestNotes('')
        }
    }, [isOpen])

    useEffect(() => {
        if (isOpen && step === 'choice' && !isOrgMember) {
            loadJourneys()
        }
    }, [isOpen, step, isOrgMember])

    const loadJourneys = async () => {
        setLoadingJourneys(true)
        const result = await getAvailableJourneys(userId, journeyId)
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
            toast.success('Congratulations! You are now a Leader!')
            onClose()
            router.push('/dashboard?graduated=true')
            router.refresh()
        } else {
            toast.error(result.error || 'Failed to graduate. Please try again.')
        }
    }

    const handleStartNewJourney = async (journeyId: string) => {
        setIsLoading(true)
        const result = await startNewJourney(pairingId, journeyId)
        setIsLoading(false)

        if (result.success) {
            toast.success('New journey started!')
            onClose()
            router.push('/dashboard?newJourney=true')
            router.refresh()
        } else {
            toast.error(result.error || 'Failed to start new journey. Please try again.')
        }
    }

    const handleSubmitRequest = async (type: 'become_leader' | 'new_journey') => {
        if (!organizationId) return

        setIsLoading(true)
        const result = await submitOrgMemberRequest({
            userId,
            organizationId,
            requestType: type,
            notes: requestNotes || undefined,
        })
        setIsLoading(false)

        if (result.success) {
            toast.success('Request submitted to your organization admin!')
            setStep('request-sent')
        } else {
            toast.error(result.error || 'Failed to submit request')
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Celebration Step */}
                {step === 'celebration' && (
                    <>
                        <DialogHeader className="text-center pb-4">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                                <Trophy className="h-10 w-10 text-white" />
                            </div>
                            <DialogTitle className="text-2xl sm:text-3xl">
                                Congratulations, {userName}!
                            </DialogTitle>
                            <DialogDescription className="text-base mt-2">
                                You have completed the <span className="font-semibold text-foreground">{journeyName}</span> journey!
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="rounded-lg border bg-success/5 border-success/20 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
                                        <Check className="h-6 w-6 text-success" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-lg">Journey Complete!</p>
                                        <p className="text-sm text-muted-foreground">
                                            You've completed all 6 weeks of assignments and spiritual growth
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <div className="flex items-center justify-center gap-2">
                                    <PartyPopper className="h-5 w-5 text-amber-500" />
                                    <span className="font-medium">What an amazing achievement!</span>
                                    <PartyPopper className="h-5 w-5 text-amber-500" />
                                </div>
                                <p className="text-muted-foreground">
                                    You now have exciting new opportunities to continue your discipleship journey.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-center pt-2">
                            <Button onClick={() => setStep('choice')} size="lg" className="px-8">
                                <Sparkles className="mr-2 h-4 w-4" />
                                See My Options
                            </Button>
                        </div>
                    </>
                )}

                {/* Choice Step */}
                {step === 'choice' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>What's Next?</DialogTitle>
                            <DialogDescription>
                                Choose how you'd like to continue your discipleship journey
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4 sm:grid-cols-2">
                            {/* Become a Leader Option */}
                            <Card
                                className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${!canBeLeader && !isOrgMember ? 'opacity-60' : ''}`}
                                onClick={() => {
                                    if (isOrgMember) {
                                        setStep('request-leader')
                                    } else if (canBeLeader) {
                                        handleGraduateToLeader()
                                    }
                                }}
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

                                    {isOrgMember ? (
                                        <Button className="w-full mt-4" variant="outline" disabled={isLoading}>
                                            <Send className="mr-2 h-4 w-4" />
                                            Request from Admin
                                        </Button>
                                    ) : canBeLeader ? (
                                        <Button className="w-full mt-4" disabled={isLoading}>
                                            {isLoading ? <Spinner className="mr-2" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                                            Graduate to Leader
                                        </Button>
                                    ) : (
                                        <p className="mt-3 text-xs text-destructive">
                                            Your subscription doesn't include leader capabilities.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Start New Journey Option */}
                            <Card
                                className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                                onClick={() => {
                                    if (isOrgMember) {
                                        setStep('request-journey')
                                    }
                                }}
                            >
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
                                    {isOrgMember ? (
                                        // Org members request from admin
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                Request a new journey assignment from your organization admin.
                                            </p>
                                            <Button className="w-full" variant="outline" disabled={isLoading}>
                                                <Send className="mr-2 h-4 w-4" />
                                                Request New Journey
                                            </Button>
                                        </div>
                                    ) : (
                                        // Individual users see journey options or pricing
                                        <>
                                            {loadingJourneys ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Spinner />
                                                </div>
                                            ) : availableJourneys.filter(j => j.canStart).length > 0 ? (
                                                <div className="space-y-2">
                                                    {availableJourneys.filter(j => j.canStart).slice(0, 3).map((journey) => (
                                                        <button
                                                            key={journey.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleStartNewJourney(journey.id)
                                                            }}
                                                            disabled={isLoading}
                                                            className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                                                        >
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-medium text-sm">{journey.name}</span>
                                                                <Badge variant="secondary" className="text-xs">Available</Badge>
                                                            </div>
                                                            {journey.description && (
                                                                <p className="text-xs text-muted-foreground line-clamp-2">{journey.description}</p>
                                                            )}
                                                        </button>
                                                    ))}
                                                    {availableJourneys.filter(j => !j.canStart && !j.isCompleted).length > 0 && (
                                                        <Button asChild className="w-full mt-2" variant="outline" size="sm">
                                                            <Link href="/pricing">
                                                                <ShoppingCart className="mr-2 h-3 w-3" />
                                                                Browse More Journeys
                                                            </Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-muted-foreground text-center">
                                                        {availableJourneys.length > 0
                                                            ? "Purchase access to start a new journey."
                                                            : "No additional journeys available at this time."}
                                                    </p>
                                                    {availableJourneys.length > 0 && (
                                                        <Button asChild className="w-full" variant="outline">
                                                            <Link href="/pricing">
                                                                <ShoppingCart className="mr-2 h-4 w-4" />
                                                                View Available Journeys
                                                            </Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Archive option */}
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Archive className="h-4 w-4" />
                                    <span>Your completed journey will be saved in your archive</span>
                                </div>
                                <Button variant="ghost" onClick={onClose}>
                                    Decide Later
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Request Leader Step (Org Members) */}
                {step === 'request-leader' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Request to Become a Leader</DialogTitle>
                            <DialogDescription>
                                Submit a request to your organization admin to become a leader
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="rounded-lg bg-muted/50 p-4">
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{organizationName}</p>
                                        <p className="text-sm text-muted-foreground">Your organization admin will review this request</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Add a note (optional)</label>
                                <Textarea
                                    placeholder="Share any details about why you'd like to become a leader..."
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep('choice')} className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={() => handleSubmitRequest('become_leader')}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                {isLoading ? <Spinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                                Submit Request
                            </Button>
                        </div>
                    </>
                )}

                {/* Request Journey Step (Org Members) */}
                {step === 'request-journey' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Request a New Journey</DialogTitle>
                            <DialogDescription>
                                Submit a request to your organization admin for a new journey assignment
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            <div className="rounded-lg bg-muted/50 p-4">
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">{organizationName}</p>
                                        <p className="text-sm text-muted-foreground">Your admin will assign you a new journey and leader</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Add a note (optional)</label>
                                <Textarea
                                    placeholder="Any preferences for your next journey or leader..."
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setStep('choice')} className="flex-1">
                                Back
                            </Button>
                            <Button
                                onClick={() => handleSubmitRequest('new_journey')}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                {isLoading ? <Spinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                                Submit Request
                            </Button>
                        </div>
                    </>
                )}

                {/* Request Sent Confirmation */}
                {step === 'request-sent' && (
                    <>
                        <DialogHeader className="text-center pb-4">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                                <Check className="h-8 w-8 text-success" />
                            </div>
                            <DialogTitle className="text-xl">Request Submitted!</DialogTitle>
                            <DialogDescription className="text-base mt-2">
                                Your organization admin has been notified and will review your request.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            <div className="rounded-lg bg-muted/50 p-4 text-center">
                                <p className="text-sm text-muted-foreground">
                                    You'll receive a notification when your request is approved. In the meantime,
                                    your completed journey has been archived for you to review anytime.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <Button onClick={onClose} className="px-8">
                                Close
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
