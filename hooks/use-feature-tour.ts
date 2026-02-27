'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const TOUR_PREFIX = 'swr-tour-'

// ── Global tour state tracking ──
// Tracks how many tours are currently active. The daily-journal popup
// subscribes so it can wait until all tours finish before showing.
let activeTourCount = 0
const tourStateListeners = new Set<(active: boolean) => void>()

function tourStarted() {
    activeTourCount++
    tourStateListeners.forEach(cb => cb(true))
}

function tourEnded() {
    activeTourCount = Math.max(0, activeTourCount - 1)
    if (activeTourCount === 0) {
        tourStateListeners.forEach(cb => cb(false))
    }
}

/** Returns true if any feature tour is currently shown */
export function isAnyTourActive(): boolean {
    return activeTourCount > 0
}

/**
 * Subscribe to tour state changes.
 * Callback receives `true` when a tour becomes active, `false` when ALL tours finish.
 * Returns an unsubscribe function.
 */
export function onTourStateChange(cb: (active: boolean) => void) {
    tourStateListeners.add(cb)
    return () => { tourStateListeners.delete(cb) }
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

export function useFeatureTour(tourId: string, waitFor?: boolean) {
    const [showTour, setShowTour] = useState(false)
    const key = `${TOUR_PREFIX}${tourId}-done`
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Track if this hook has already called tourStarted() to avoid double-counting
    const startedRef = useRef(false)

    // When waitFor is explicitly false, don't activate yet
    const isReady = waitFor === undefined || waitFor === true

    useEffect(() => {
        if (!isReady) return

        let cancelled = false
        let timerRef: ReturnType<typeof setTimeout> | null = null

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

            // Signal that this tour intends to show (blocks journal popup)
            if (!startedRef.current) {
                tourStarted()
                startedRef.current = true
            }

            timerRef = setTimeout(() => {
                if (cancelled) { tourEnded(); startedRef.current = false; return }
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
        }

        init()

        return () => {
            cancelled = true
            if (timerRef) clearTimeout(timerRef)
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [key, tourId, isReady])

    const completeTour = useCallback(() => {
        localStorage.setItem(key, 'true')
        setShowTour(false)
        markTourCompletedInDB(tourId)
        if (startedRef.current) {
            tourEnded()
            startedRef.current = false
        }
    }, [key, tourId])

    const resetTour = useCallback(() => {
        localStorage.removeItem(key)
        setShowTour(true)
    }, [key])

    return { showTour, completeTour, resetTour }
}
