'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Users, UserPlus, Crown } from 'lucide-react'
import type { Profile, Pairing, SubscriptionTier } from '@/lib/types'
import Link from 'next/link'
import { setSelectedPairingId } from '@/lib/selected-pairing'

interface LearnerWithPairing {
    pairing: Pairing
    learner: Profile
}

interface LearnerSwitcherProps {
    learners: LearnerWithPairing[]
    currentPairingId: string
    className?: string
    maxLearners?: number
    subscriptionTier?: SubscriptionTier | null
}

export function LearnerSwitcher({
    learners,
    currentPairingId,
    className,
    maxLearners = 1,
    subscriptionTier,
}: LearnerSwitcherProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)

    const currentLearner = learners.find(l => l.pairing.id === currentPairingId)

    // Check if leader can add more learners based on their subscription tier
    const currentLearnerCount = learners.length
    const canAddMoreLearners = currentLearnerCount < maxLearners
    const tierName = subscriptionTier?.display_name || 'Basic'

    if (learners.length === 0) {
        return null
    }

    const handleSelectLearner = async (pairingId: string) => {
        // Save selection to cookie for persistence across pages
        await setSelectedPairingId(pairingId)
        // Navigate to dashboard with the new pairing
        router.push(`/dashboard?pairing=${pairingId}`)
        router.refresh()
        setIsOpen(false)
    }

    const getInitials = (name: string | null | undefined) => {
        if (!name) return '?'
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
    }

    // If only one learner, show simplified view with option to add more
    if (learners.length === 1) {
        return (
            <div className={className}>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                        {currentLearner?.learner?.avatar_url && (
                            <AvatarImage src={currentLearner.learner.avatar_url} alt={currentLearner.learner.full_name || 'Learner'} />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(currentLearner?.learner?.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {currentLearner?.learner?.full_name || 'Learner'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Week {currentLearner?.pairing?.current_week || 1}
                        </p>
                    </div>
                </div>
                {canAddMoreLearners ? (
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground hover:text-foreground" asChild>
                        <Link href="/dashboard?new=true">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Another Learner
                        </Link>
                    </Button>
                ) : (
                    <div className="mt-2 p-2 rounded-md bg-muted/50 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                            <Crown className="h-3 w-3" />
                            <span>{tierName}: {maxLearners} learner{maxLearners > 1 ? 's' : ''} max</span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={className}>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between gap-2 h-auto py-2 px-3 bg-background">
                        <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                                {currentLearner?.learner?.avatar_url && (
                                    <AvatarImage src={currentLearner.learner.avatar_url} alt={currentLearner.learner.full_name || 'Learner'} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {getInitials(currentLearner?.learner?.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium truncate">
                                    {currentLearner?.learner?.full_name || 'Select Learner'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Week {currentLearner?.pairing?.current_week || 1}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="text-xs">
                                {learners.length}
                            </Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px]">
                    <DropdownMenuLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Your Learners
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {learners.map(({ pairing, learner }) => (
                        <DropdownMenuItem
                            key={pairing.id}
                            onClick={() => handleSelectLearner(pairing.id)}
                            className={`flex items-center gap-3 cursor-pointer ${pairing.id === currentPairingId ? 'bg-primary/5' : ''}`}
                        >
                            <Avatar className="h-8 w-8 shrink-0">
                                {learner?.avatar_url && (
                                    <AvatarImage src={learner.avatar_url} alt={learner.full_name || 'Learner'} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {getInitials(learner?.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {learner?.full_name || 'Learner'}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        Week {pairing.current_week || 1}
                                    </span>
                                    {pairing.status === 'pending' && (
                                        <Badge variant="secondary" className="text-[10px] h-4">Pending</Badge>
                                    )}
                                    {pairing.status === 'completed' && (
                                        <Badge variant="default" className="text-[10px] h-4 bg-success">Complete</Badge>
                                    )}
                                </div>
                            </div>
                            {pairing.id === currentPairingId && (
                                <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {canAddMoreLearners ? (
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard?new=true" className="flex items-center gap-2 cursor-pointer">
                                <UserPlus className="h-4 w-4" />
                                <span>Add New Learner</span>
                            </Link>
                        </DropdownMenuItem>
                    ) : (
                        <div className="px-2 py-1.5 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                                <Crown className="h-3 w-3" />
                                <span>{tierName}: {currentLearnerCount}/{maxLearners} learners</span>
                            </div>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
