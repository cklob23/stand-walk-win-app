'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles, Trophy, Star, Heart, Flame, Mountain, Sun, ArrowRight } from 'lucide-react'
import confetti from 'canvas-confetti'

// Different celebration content for each week
const WEEK_CELEBRATIONS = [
    {
        week: 1,
        title: "First Week Complete!",
        subtitle: "The New Birth",
        message: "You've taken your first steps on this incredible journey. Just like a newborn learning to breathe, you're beginning to understand what it means to be born again in Christ.",
        encouragement: "Keep going - the best is yet to come!",
        icon: Star,
        gradient: "from-amber-500 to-orange-500",
        bgGradient: "from-amber-50 to-orange-50",
    },
    {
        week: 2,
        title: "Week Two Complete!",
        subtitle: "The New Life",
        message: "You're developing essential spiritual disciplines. Prayer and Bible study are becoming part of your daily walk. Your roots are growing deeper!",
        encouragement: "You're building habits that will last a lifetime.",
        icon: Heart,
        gradient: "from-rose-500 to-pink-500",
        bgGradient: "from-rose-50 to-pink-50",
    },
    {
        week: 3,
        title: "Halfway There!",
        subtitle: "The New Stand",
        message: "Three weeks down! You're learning to stand firm in your faith despite challenges. Your foundation is becoming rock solid.",
        encouragement: "You're proving that your commitment is real!",
        icon: Mountain,
        gradient: "from-emerald-500 to-teal-500",
        bgGradient: "from-emerald-50 to-teal-50",
    },
    {
        week: 4,
        title: "Week Four Done!",
        subtitle: "The New Walk",
        message: "You're now walking confidently in your faith. The way you live each day is reflecting your new identity in Christ.",
        encouragement: "Your daily walk is becoming your testimony!",
        icon: Sun,
        gradient: "from-sky-500 to-blue-500",
        bgGradient: "from-sky-50 to-blue-50",
    },
    {
        week: 5,
        title: "Almost There!",
        subtitle: "The New Run",
        message: "Five weeks complete! You're not just walking anymore - you're running the race set before you. Your endurance is inspiring!",
        encouragement: "One more week to go. Finish strong!",
        icon: Flame,
        gradient: "from-orange-500 to-red-500",
        bgGradient: "from-orange-50 to-red-50",
    },
]

interface WeekCelebrationModalProps {
    isOpen: boolean
    onClose: () => void
    weekNumber: number
    weekTitle?: string
    onContinue?: () => void
}

export function WeekCelebrationModal({
    isOpen,
    onClose,
    weekNumber,
    weekTitle,
    onContinue,
}: WeekCelebrationModalProps) {
    const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false)

    // Get celebration content for this week (weeks 1-5)
    const celebration = WEEK_CELEBRATIONS[weekNumber - 1] || WEEK_CELEBRATIONS[0]
    const IconComponent = celebration.icon

    useEffect(() => {
        if (isOpen && !hasTriggeredConfetti) {
            // Trigger confetti when modal opens
            const duration = 2000
            const end = Date.now() + duration

            const colors = ['#0f6353', '#f0ede6', '#fbbf24', '#10b981']

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors,
                })
                confetti({
                    particleCount: 3,
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
    }, [isOpen, hasTriggeredConfetti])

    // Reset confetti trigger when modal closes
    useEffect(() => {
        if (!isOpen) {
            setHasTriggeredConfetti(false)
        }
    }, [isOpen])

    const handleContinue = () => {
        onClose()
        onContinue?.()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open: any) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg overflow-hidden p-0">
                {/* Header with gradient background */}
                <div className={`bg-gradient-to-br ${celebration.bgGradient} dark:from-muted dark:to-muted/50 px-6 pt-8 pb-6`}>
                    <div className="flex flex-col items-center text-center">
                        {/* Icon with gradient background */}
                        <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${celebration.gradient} shadow-lg`}>
                            <IconComponent className="h-10 w-10 text-white" />
                        </div>

                        {/* Week indicator */}
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-medium text-muted-foreground">Week {weekNumber} of 6</span>
                            <Sparkles className="h-4 w-4 text-amber-500" />
                        </div>

                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl sm:text-3xl font-bold">
                                {celebration.title}
                            </DialogTitle>
                            <DialogDescription className="text-base font-medium text-foreground/80">
                                {weekTitle || celebration.subtitle}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6 space-y-4">
                    <p className="text-center text-muted-foreground leading-relaxed">
                        {celebration.message}
                    </p>

                    {/* Progress visual */}
                    <div className="flex items-center justify-center gap-1.5 py-2">
                        {[1, 2, 3, 4, 5, 6].map((week) => (
                            <div
                                key={week}
                                className={`h-2.5 w-8 rounded-full transition-colors ${week <= weekNumber
                                        ? `bg-gradient-to-r ${celebration.gradient}`
                                        : 'bg-muted'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Encouragement message */}
                    <div className="rounded-lg border bg-muted/30 p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <span className="font-medium text-sm">Keep Growing!</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {celebration.encouragement}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">
                        Close
                    </Button>
                    <Button onClick={handleContinue} className="flex-1">
                        Continue to Week {weekNumber + 1}
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
