'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFeatureTour } from '@/hooks/use-feature-tour'

export interface TourStep {
    title: string
    description: string
    targetSelector?: string // CSS selector for the element to spotlight
}

interface FeatureTourProps {
    tourId: string
    steps: TourStep[]
    onComplete?: () => void
}

export function FeatureTour({ tourId, steps, onComplete }: FeatureTourProps) {
    const { showTour, completeTour } = useFeatureTour(tourId)
    const [currentStep, setCurrentStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    // Fade in after mount
    useEffect(() => {
        if (showTour) {
            const t = setTimeout(() => setVisible(true), 50)
            return () => clearTimeout(t)
        } else {
            setVisible(false)
        }
    }, [showTour])

    // Find and spotlight the target element, scrolling it into view if needed
    const updateSpotlight = useCallback(() => {
        const step = steps[currentStep]
        if (!step?.targetSelector) {
            setSpotlightRect(null)
            return
        }
        const el = document.querySelector(step.targetSelector)
        if (el) {
            // Scroll into view if not visible
            const rect = el.getBoundingClientRect()
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
            if (!isVisible) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // Recalculate rect after scroll settles
                setTimeout(() => {
                    const newRect = el.getBoundingClientRect()
                    setSpotlightRect(newRect)
                }, 400)
            } else {
                setSpotlightRect(rect)
            }
        } else {
            setSpotlightRect(null)
        }
    }, [currentStep, steps])

    useEffect(() => {
        if (!showTour) return
        updateSpotlight()
        window.addEventListener('resize', updateSpotlight)
        window.addEventListener('scroll', updateSpotlight, true)
        return () => {
            window.removeEventListener('resize', updateSpotlight)
            window.removeEventListener('scroll', updateSpotlight, true)
        }
    }, [showTour, updateSpotlight])

    const handleClose = useCallback(() => {
        setVisible(false)
        setTimeout(() => {
            completeTour()
            onComplete?.()
        }, 200)
    }, [completeTour, onComplete])

    const handleNext = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1)
        } else {
            handleClose()
        }
    }, [currentStep, steps.length, handleClose])

    const handleBack = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
        }
    }, [currentStep])

    // Note: we intentionally do NOT lock body scroll -- dashboard and other
    // pages use nested scroll containers and locking body would have no
    // visible effect while breaking the tour. The overlay itself prevents
    // interaction with elements underneath.

    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    if (!showTour || steps.length === 0 || !mounted) return null

    const step = steps[currentStep]
    const isLast = currentStep === steps.length - 1
    const isFirst = currentStep === 0
    const padding = 8

    // Build the overlay clip path to cut out the spotlight
    const clipPath = spotlightRect
        ? `polygon(
        0% 0%, 0% 100%, 
        ${spotlightRect.left - padding}px 100%, 
        ${spotlightRect.left - padding}px ${spotlightRect.top - padding}px, 
        ${spotlightRect.right + padding}px ${spotlightRect.top - padding}px, 
        ${spotlightRect.right + padding}px ${spotlightRect.bottom + padding}px, 
        ${spotlightRect.left - padding}px ${spotlightRect.bottom + padding}px, 
        ${spotlightRect.left - padding}px 100%, 
        100% 100%, 100% 0%
      )`
        : undefined

    // Position the card near the spotlight or centered
    const getCardStyle = (): React.CSSProperties => {
        // On mobile (< 640px), always bottom sheet
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
            return {
                position: 'fixed',
                bottom: '24px',
                left: '16px',
                right: '16px',
                zIndex: 10001,
            }
        }

        if (!spotlightRect) {
            // Centered modal
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
            }
        }

        // Position card below or above the spotlight
        const viewportHeight = window.innerHeight
        const cardHeight = 200
        const gap = 16
        const spaceBelow = viewportHeight - spotlightRect.bottom - padding
        const spaceAbove = spotlightRect.top - padding

        if (spaceBelow > cardHeight + gap) {
            // Place below
            return {
                position: 'fixed',
                top: `${spotlightRect.bottom + padding + gap}px`,
                left: `${Math.max(16, Math.min(spotlightRect.left, window.innerWidth - 380))}px`,
                zIndex: 10001,
            }
        } else if (spaceAbove > cardHeight + gap) {
            // Place above
            return {
                position: 'fixed',
                bottom: `${viewportHeight - spotlightRect.top + padding + gap}px`,
                left: `${Math.max(16, Math.min(spotlightRect.left, window.innerWidth - 380))}px`,
                zIndex: 10001,
            }
        } else {
            // Centered fallback
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
            }
        }
    }

    return createPortal(
        <>
            {/* Full-screen click catcher (transparent, behind the dark overlay) */}
            <div
                className="fixed inset-0"
                style={{ zIndex: 9999 }}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Overlay backdrop with spotlight cutout */}
            <div
                className={cn(
                    'fixed inset-0 transition-opacity duration-300 pointer-events-none',
                    visible ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                    zIndex: 10000,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    clipPath,
                }}
                aria-hidden="true"
            />

            {/* Spotlight border ring */}
            {spotlightRect && (
                <div
                    className={cn(
                        'fixed rounded-lg ring-2 ring-primary/60 transition-all duration-300 pointer-events-none',
                        visible ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{
                        zIndex: 10000,
                        top: spotlightRect.top - padding,
                        left: spotlightRect.left - padding,
                        width: spotlightRect.width + padding * 2,
                        height: spotlightRect.height + padding * 2,
                    }}
                    aria-hidden="true"
                />
            )}

            {/* Tour card */}
            <div
                ref={cardRef}
                className={cn(
                    'w-full max-w-[360px] rounded-xl bg-card border border-border shadow-2xl transition-all duration-300',
                    visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                )}
                style={getCardStyle()}
                role="dialog"
                aria-modal="true"
                aria-label={`Feature tour step ${currentStep + 1} of ${steps.length}`}
                data-feature-tour
            >
                {/* Header: step counter + skip */}
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                        {currentStep + 1} / {steps.length}
                    </span>
                    <button
                        onClick={handleClose}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Skip tour"
                    >
                        Skip
                        <X className="h-3 w-3" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 pb-2">
                    <h3 className="text-base font-semibold text-foreground text-balance leading-snug">
                        {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                        {step.description}
                    </p>
                </div>

                {/* Footer: navigation */}
                <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        disabled={isFirst}
                        className={cn('h-9 gap-1 text-sm', isFirst && 'invisible')}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleNext}
                        className="h-9 gap-1 text-sm bg-primary text-primary-foreground hover:bg-primary/90 min-w-[90px]"
                    >
                        {isLast ? 'Got it!' : 'Next'}
                        {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </div>
        </>,
        document.body
    )
}
