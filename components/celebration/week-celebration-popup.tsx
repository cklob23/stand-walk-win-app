'use client'

import { useState, useEffect } from 'react'
import { WeekCelebrationModal } from './week-celebration-modal'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface WeekCelebrationPopupProps {
    pairingId: string
    celebrationWeek: number | null
    celebrationWeekTitle: string | null
}

export function WeekCelebrationPopup({
    pairingId,
    celebrationWeek,
    celebrationWeekTitle,
}: WeekCelebrationPopupProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isDismissing, setIsDismissing] = useState(false)

    // Show modal when there's a celebration to show
    useEffect(() => {
        if (celebrationWeek && celebrationWeek > 0) {
            // Small delay to let page settle
            const timer = setTimeout(() => {
                setOpen(true)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [celebrationWeek])

    const handleDismiss = async () => {
        if (isDismissing) return
        setIsDismissing(true)

        try {
            // Update the last_celebrated_week in the database
            const supabase = createClient()
            await supabase
                .from('pairings')
                .update({ last_celebrated_week: celebrationWeek })
                .eq('id', pairingId)
        } catch (error) {
            console.error('Error updating celebration status:', error)
        }

        setOpen(false)
        setIsDismissing(false)
    }

    const handleContinue = async () => {
        await handleDismiss()
        router.refresh()
    }

    // Don't render anything if no celebration
    if (!celebrationWeek || celebrationWeek <= 0) {
        return null
    }

    return (
        <WeekCelebrationModal
            isOpen={open}
            onClose={handleDismiss}
            weekNumber={celebrationWeek}
            weekTitle={celebrationWeekTitle || undefined}
            onContinue={handleContinue}
        />
    )
}
