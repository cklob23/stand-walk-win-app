'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const TOUR_PREFIX = 'swr-tour-'

// Global event emitter so the daily-journal popup can listen for tour completion
const tourCompleteListeners = new Set<() => void>()
export function onTourComplete(cb: () => void) {
    tourCompleteListeners.add(cb)
    return () => { tourCompleteListeners.delete(cb) }
}
function emitTourComplete() {
    tourCompleteListeners.forEach(cb => cb())
}

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

// Persist tour completion to the DB so it carries across devices
async function markTourCompletedInDB(tourId: string) {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('completed_tours')
            .eq('id', user.id)
            .single()

        const existing: string[] = (profile?.completed_tours as string[]) || []
        if (existing.includes(tourId)) return

        await supabase
            .from('profiles')
            .update({ completed_tours: [...existing, tourId] })
            .eq('id', user.id)
    } catch {
        // Silent fail -- localStorage still acts as a fallback
    }
}

// Check if tour was already completed in DB
async function isTourCompletedInDB(tourId: string): Promise<boolean> {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false

        const { data: profile } = await supabase
            .from('profiles')
            .select('completed_tours')
            .eq('id', user.id)
            .single()

        const existing: string[] = (profile?.completed_tours as string[]) || []
        return existing.includes(tourId)
    } catch {
        return false
    }
}

export function useFeatureTour(tourId: string) {
    const [showTour, setShowTour] = useState(false)
    const key = `${TOUR_PREFIX}${tourId}-done`
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        let cancelled = false

        async function init() {
            // Check localStorage first (fast)
            const localDone = localStorage.getItem(key)
            if (localDone) return

            // Then check the DB (handles cross-device)
            const dbDone = await isTourCompletedInDB(tourId)
            if (dbDone) {
                // Sync back to localStorage for future visits
                localStorage.setItem(key, 'true')
                return
            }

            if (cancelled) return

            const initialTimer = setTimeout(() => {
                if (cancelled) return
                if (!isBlockingDialogOpen()) {
                    setShowTour(true)
                    return
                }
                pollRef.current = setInterval(() => {
                    if (cancelled) return
                    if (!isBlockingDialogOpen()) {
                        setShowTour(true)
                        if (pollRef.current) clearInterval(pollRef.current)
                        pollRef.current = null
                    }
                }, 500)
            }, 1200)

            // Store timer ref for cleanup
            pollRef.current = null
            return () => clearTimeout(initialTimer)
        }

        init()

        return () => {
            cancelled = true
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [key, tourId])

    const completeTour = useCallback(() => {
        localStorage.setItem(key, 'true')
        setShowTour(false)
        markTourCompletedInDB(tourId)
        emitTourComplete()
    }, [key, tourId])

    const resetTour = useCallback(() => {
        localStorage.removeItem(key)
        setShowTour(true)
    }, [key])

    return { showTour, completeTour, resetTour }
}
