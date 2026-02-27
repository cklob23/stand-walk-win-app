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
    /** When set, the tour will not activate until this becomes true */
    waitFor?: boolean
}

interface SmoothRect {
    top: number
    left: number
    width: number
    height: number
}

export function FeatureTour({ tourId, steps, onComplete, waitFor }: FeatureTourProps) {
    const { showTour, completeTour } = useFeatureTour(tourId, waitFor)
    const [currentStep, setCurrentStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [smoothRect, setSmoothRect] = useState<SmoothRect | null>(null)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const animFrameRef = useRef<number>(0)

    // Fade in after mount
    useEffect(() => {
        if (showTour) {
            const t = setTimeout(() => setVisible(true), 50)
            return () => clearTimeout(t)
        } else {
            setVisible(false)
        }
    }, [showTour])

    // Smoothly animate the spotlight rect using CSS transitions
    // Update smoothRect whenever targetRect changes
    useEffect(() => {
        if (!targetRect) {
            setSmoothRect(null)
            return
        }
        setSmoothRect({
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
        })
    }, [targetRect])

    // Find and spotlight the target element, scrolling it into view if needed
    const updateSpotlight = useCallback(() => {
        const step = steps[currentStep]
        if (!step?.targetSelector) {
            setTargetRect(null)
            return
        }
        const el = document.querySelector(step.targetSelector)
        if (el) {
            const rect = el.getBoundingClientRect()
            const viewH = window.innerHeight
            // Calculate visible area considering the card height (~220px)
            const cardHeight = 220
            const padding = 8
            const gap = 16
            // Check if element is in a position where it won't be blocked by the card
            const isVisible = rect.top >= 0 && rect.bottom <= viewH

            if (!isVisible) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                    setTargetRect(el.getBoundingClientRect())
                }, 450)
            } else {
                // On mobile, check if the card at the bottom would overlap the target
                const isMobile = window.innerWidth < 640
                if (isMobile) {
                    const cardTop = viewH - cardHeight - 24 // bottom: 24px + card height
                    const spotlightBottom = rect.bottom + padding + gap
                    if (spotlightBottom > cardTop) {
                        // Target would be blocked -- scroll it up so there's room
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        setTimeout(() => {
                            setTargetRect(el.getBoundingClientRect())
                        }, 450)
                        return
                    }
                }
                setTargetRect(rect)
            }
        } else {
            setTargetRect(null)
        }
    }, [currentStep, steps])

    useEffect(() => {
        if (!showTour) return
        // Small delay to let the transition state settle
        const timer = setTimeout(() => {
            updateSpotlight()
            setIsTransitioning(false)
        }, 80)
        window.addEventListener('resize', updateSpotlight)
        window.addEventListener('scroll', updateSpotlight, true)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', updateSpotlight)
            window.removeEventListener('scroll', updateSpotlight, true)
        }
    }, [showTour, updateSpotlight])

    const handleClose = useCallback(() => {
        setVisible(false)
        setTimeout(() => {
            completeTour()
            onComplete?.()
        }, 250)
    }, [completeTour, onComplete])

    const handleNext = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setIsTransitioning(true)
            setCurrentStep(prev => prev + 1)
        } else {
            handleClose()
        }
    }, [currentStep, steps.length, handleClose])

    const handleBack = useCallback(() => {
        if (currentStep > 0) {
            setIsTransitioning(true)
            setCurrentStep(prev => prev - 1)
        }
    }, [currentStep])

    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    if (!showTour || steps.length === 0 || !mounted) return null

    const step = steps[currentStep]
    const isLast = currentStep === steps.length - 1
    const isFirst = currentStep === 0
    const padding = 8

    // Build overlay clip path from the smoothed rect
    const clipPath = smoothRect
        ? `polygon(
        0% 0%, 0% 100%, 
        ${smoothRect.left - padding}px 100%, 
        ${smoothRect.left - padding}px ${smoothRect.top - padding}px, 
        ${smoothRect.left + smoothRect.width + padding}px ${smoothRect.top - padding}px, 
        ${smoothRect.left + smoothRect.width + padding}px ${smoothRect.top + smoothRect.height + padding}px, 
        ${smoothRect.left - padding}px ${smoothRect.top + smoothRect.height + padding}px, 
        ${smoothRect.left - padding}px 100%, 
        100% 100%, 100% 0%
      )`
        : undefined

    // Position the card near the spotlight
    const getCardStyle = (): React.CSSProperties => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
        const isTablet = typeof window !== 'undefined' && window.innerWidth >= 640 && window.innerWidth < 1024

        // On mobile: position at bottom, but check if spotlight is near bottom
        if (isMobile) {
            if (smoothRect) {
                const spotlightBottom = smoothRect.top + smoothRect.height + padding
                const cardFromBottom = 24
                const cardHeight = 220
                const cardTop = window.innerHeight - cardFromBottom - cardHeight

                // If spotlight is in the bottom half, put the card at the TOP
                if (spotlightBottom > cardTop - 16) {
                    return {
                        position: 'fixed',
                        top: '16px',
                        left: '12px',
                        right: '12px',
                        zIndex: 10001,
                    }
                }
            }
            return {
                position: 'fixed',
                bottom: '24px',
                left: '12px',
                right: '12px',
                zIndex: 10001,
            }
        }

        // On tablet: similar logic but with more width
        if (isTablet) {
            if (smoothRect) {
                const spotlightBottom = smoothRect.top + smoothRect.height + padding
                const cardFromBottom = 24
                const cardHeight = 220
                const cardTop = window.innerHeight - cardFromBottom - cardHeight

                if (spotlightBottom > cardTop - 16) {
                    return {
                        position: 'fixed',
                        top: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10001,
                    }
                }
            }
            return {
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10001,
            }
        }

        if (!smoothRect) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
            }
        }

        // Desktop: position card below or above the spotlight
        const viewportHeight = window.innerHeight
        const cardHeight = 220
        const gap = 16
        const spaceBelow = viewportHeight - (smoothRect.top + smoothRect.height) - padding
        const spaceAbove = smoothRect.top - padding

        if (spaceBelow > cardHeight + gap) {
            return {
                position: 'fixed',
                top: `${smoothRect.top + smoothRect.height + padding + gap}px`,
                left: `${Math.max(16, Math.min(smoothRect.left, window.innerWidth - 380))}px`,
                zIndex: 10001,
            }
        } else if (spaceAbove > cardHeight + gap) {
            return {
                position: 'fixed',
                bottom: `${viewportHeight - smoothRect.top + padding + gap}px`,
                left: `${Math.max(16, Math.min(smoothRect.left, window.innerWidth - 380))}px`,
                zIndex: 10001,
            }
        } else {
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
            {/* Full-screen click catcher */}
            <div
                className="fixed inset-0"
                style={{ zIndex: 9999 }}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Overlay backdrop with spotlight cutout -- smooth transition on clip-path */}
            <div
                className={cn(
                    'fixed inset-0 pointer-events-none',
                    visible ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                    zIndex: 10000,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    clipPath,
                    transition: 'opacity 300ms ease, clip-path 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                aria-hidden="true"
            />

            {/* Spotlight border ring -- smooth animated position */}
            {smoothRect && (
                <div
                    className={cn(
                        'fixed rounded-lg ring-2 ring-primary/60 pointer-events-none',
                        visible ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{
                        zIndex: 10000,
                        top: smoothRect.top - padding,
                        left: smoothRect.left - padding,
                        width: smoothRect.width + padding * 2,
                        height: smoothRect.height + padding * 2,
                        transition: 'top 400ms cubic-bezier(0.4, 0, 0.2, 1), left 400ms cubic-bezier(0.4, 0, 0.2, 1), width 400ms cubic-bezier(0.4, 0, 0.2, 1), height 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease',
                    }}
                    aria-hidden="true"
                />
            )}

            {/* Tour card -- smooth transitions */}
            <div
                ref={cardRef}
                className={cn(
                    'w-full max-w-[360px] rounded-xl bg-card border border-border shadow-2xl',
                    visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                )}
                style={{
                    ...getCardStyle(),
                    transition: 'opacity 300ms ease, transform 300ms ease, top 400ms cubic-bezier(0.4, 0, 0.2, 1), bottom 400ms cubic-bezier(0.4, 0, 0.2, 1), left 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={`Feature tour step ${currentStep + 1} of ${steps.length}`}
                data-feature-tour
            >
                {/* Progress dots */}
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                    <div className="flex items-center gap-1.5">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'h-1.5 rounded-full transition-all duration-300',
                                    i === currentStep
                                        ? 'w-4 bg-primary'
                                        : i < currentStep
                                            ? 'w-1.5 bg-primary/40'
                                            : 'w-1.5 bg-muted-foreground/20'
                                )}
                            />
                        ))}
                    </div>
                    <button
                        onClick={handleClose}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Skip tour"
                    >
                        Skip
                        <X className="h-3 w-3" />
                    </button>
                </div>

                {/* Content with fade transition */}
                <div className={cn(
                    'px-5 pb-2 transition-opacity duration-200',
                    isTransitioning ? 'opacity-0' : 'opacity-100'
                )}>
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
