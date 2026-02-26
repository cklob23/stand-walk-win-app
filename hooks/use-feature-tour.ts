'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const TOUR_PREFIX = 'swr-tour-'

// Check if any blocking Radix Dialog is open (ignores the feature tour's own
// dialog and the daily journal popup which should not block the tour)
function isBlockingDialogOpen(): boolean {
    const dialogs = document.querySelectorAll('[data-state="open"][role="dialog"]')
    for (const d of dialogs) {
        if (d.hasAttribute('data-feature-tour')) continue
        if (d.hasAttribute('data-journal-popup') || !!d.closest('[data-journal-popup]')) continue
        return true
    }
    return false
}

export function useFeatureTour(tourId: string) {
    const [showTour, setShowTour] = useState(false)
    const key = `${TOUR_PREFIX}${tourId}-done`
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        // One-time reset: clear dashboard tour keys that were set before the
        // portal/dialog-conflict fixes so users actually see the tour.
        const resetKey = 'swr-tour-reset-v3'
        if (!localStorage.getItem(resetKey)) {
            localStorage.removeItem('swr-tour-learner-dashboard-done')
            localStorage.removeItem('swr-tour-leader-dashboard-done')
            localStorage.removeItem('swr-tour-bible-done')
            localStorage.setItem(resetKey, 'true')
        }

        const done = localStorage.getItem(key)
        if (done) return

        const initialTimer = setTimeout(() => {
            if (!isBlockingDialogOpen()) {
                setShowTour(true)
                return
            }
            pollRef.current = setInterval(() => {
                if (!isBlockingDialogOpen()) {
                    setShowTour(true)
                    if (pollRef.current) clearInterval(pollRef.current)
                    pollRef.current = null
                }
            }, 500)
        }, 1200)

        return () => {
            clearTimeout(initialTimer)
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [key])

    const completeTour = useCallback(() => {
        localStorage.setItem(key, 'true')
        setShowTour(false)
    }, [key])

    const resetTour = useCallback(() => {
        localStorage.removeItem(key)
        setShowTour(true)
    }, [key])

    return { showTour, completeTour, resetTour }
}
