'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeekCelebrationModal } from '@/components/celebration/week-celebration-modal'
import { useRouter } from 'next/navigation'

interface CelebrationContextType {
    checkForPendingCelebration: () => Promise<void>
    dismissCelebration: () => Promise<void>
}

const CelebrationContext = createContext<CelebrationContextType | null>(null)

export function useCelebration() {
    const context = useContext(CelebrationContext)
    if (!context) {
        throw new Error('useCelebration must be used within CelebrationProvider')
    }
    return context
}

interface PendingCelebration {
    weekNumber: number
    weekTitle: string
    pairingId: string
}

interface CelebrationProviderProps {
    children: ReactNode
    initialCelebration?: {
        weekNumber: number
        weekTitle: string
        pairingId: string
    } | null
}

export function CelebrationProvider({ children, initialCelebration }: CelebrationProviderProps) {
    const router = useRouter()
    const supabase = createClient()
    const [pendingCelebration, setPendingCelebration] = useState<PendingCelebration | null>(initialCelebration || null)
    const [showModal, setShowModal] = useState(!!initialCelebration)
    const [hasChecked, setHasChecked] = useState(!!initialCelebration)

    const checkForPendingCelebration = useCallback(async () => {
        // This is now primarily handled server-side via initialCelebration prop
        // But kept for manual triggering if needed
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('id, role')
                .eq('id', user.id)
                .single()

            if (!profile || profile.role !== 'learner') return

            const { data: pairing } = await supabase
                .from('pairings')
                .select('id, current_week, last_celebrated_week, status')
                .eq('learner_id', user.id)
                .eq('status', 'active')
                .single()

            if (!pairing) return

            const currentWeek = pairing.current_week || 1
            const lastCelebratedWeek = pairing.last_celebrated_week || 0

            if (currentWeek > lastCelebratedWeek + 1 && currentWeek <= 6) {
                const weekToCheck = currentWeek - 1

                const { data: weekContent } = await supabase
                    .from('weekly_content')
                    .select('id, title')
                    .eq('week_number', weekToCheck)
                    .single()

                if (!weekContent) return

                const { data: assignments } = await supabase
                    .from('assignments')
                    .select('id')
                    .eq('weekly_content_id', weekContent.id)

                if (!assignments || assignments.length === 0) return

                const assignmentIds = assignments.map((a: { id: string }) => a.id)

                const { data: progress } = await supabase
                    .from('assignment_progress')
                    .select('status')
                    .eq('pairing_id', pairing.id)
                    .in('assignment_id', assignmentIds)

                const completedCount = progress?.filter((p: { status: string }) => p.status === 'completed').length || 0

                if (completedCount >= assignments.length) {
                    setPendingCelebration({
                        weekNumber: weekToCheck,
                        weekTitle: weekContent.title,
                        pairingId: pairing.id,
                    })
                    setShowModal(true)
                }
            }
        } catch (error) {
            console.error('Error checking for pending celebration:', error)
        }
    }, [supabase])

    const dismissCelebration = useCallback(async () => {
        if (!pendingCelebration) return

        try {
            // Update the last_celebrated_week in the database
            await supabase
                .from('pairings')
                .update({ last_celebrated_week: pendingCelebration.weekNumber })
                .eq('id', pendingCelebration.pairingId)

            setShowModal(false)
            setPendingCelebration(null)
        } catch (error) {
            console.error('Error dismissing celebration:', error)
        }
    }, [pendingCelebration, supabase])

    // Check for pending celebration on mount
    useEffect(() => {
        if (!hasChecked) {
            setHasChecked(true)
            checkForPendingCelebration()
        }
    }, [hasChecked, checkForPendingCelebration])

    const handleContinue = async () => {
        await dismissCelebration()
        router.refresh()
    }

    const handleClose = async () => {
        await dismissCelebration()
    }

    return (
        <CelebrationContext.Provider value={{ checkForPendingCelebration, dismissCelebration }}>
            {children}

            {pendingCelebration && (
                <WeekCelebrationModal
                    isOpen={showModal}
                    onClose={handleClose}
                    weekNumber={pendingCelebration.weekNumber}
                    weekTitle={pendingCelebration.weekTitle}
                    onContinue={handleContinue}
                />
            )}
        </CelebrationContext.Provider>
    )
}
