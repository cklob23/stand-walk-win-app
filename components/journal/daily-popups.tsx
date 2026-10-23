'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { isAnyTourActive, onTourStateChange } from '@/hooks/use-feature-tour'
import { journalDismiss, prayerDismiss } from '@/lib/daily-popup-dismiss'
import {
    claimDailyCadence,
    journalAppliesToday,
    nextDailyPopup,
    releaseDailyCadence,
} from '@/lib/daily-prayer-cadence'
import {
    buildDailyPrayer,
    type DailyPrayerInput,
    type DailyPrayerPartner,
} from '@/lib/daily-prayer-content'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { DailyPrayerPopup } from '@/components/journal/daily-prayer-popup'

export interface DailyPopupsProps {
    pairingId: string
    hasJournalEntryToday: boolean
    journalShareName: string
    viewerRole: 'leader' | 'learner'
    partners: DailyPrayerPartner[]
    prayerInput: Omit<DailyPrayerInput, 'dateKey' | 'partnerName'>
}

export function DailyPopups({
    pairingId,
    hasJournalEntryToday,
    journalShareName,
    viewerRole,
    partners,
    prayerInput,
}: DailyPopupsProps) {
    const [active, setActive] = useState<'prayer' | 'journal' | null>(null)
    const claimRef = useRef<symbol | null>(null)

    const content = useMemo(() => {
        const dateKey = new Date().toLocaleDateString('en-CA')
        const currentPartner = partners.find((partner) => partner.pairingId === pairingId) || partners[0]
        return buildDailyPrayer({
            ...prayerInput,
            dateKey,
            partnerName: currentPartner?.name || null,
        })
    }, [pairingId, partners, prayerInput])

    useEffect(() => {
        let unsub: (() => void) | null = null
        let delayTimer: ReturnType<typeof setTimeout> | null = null

        function startCadence() {
            const token = claimDailyCadence()
            if (!token) return
            claimRef.current = token
            const next = nextDailyPopup({
                tourActive: false,
                prayerDismissedToday: prayerDismiss.isDismissedToday(),
                prayerSettledThisSession: prayerDismiss.isDismissedToday(),
                journalDismissedToday: journalDismiss.isDismissedToday(),
                journalHasEntryToday: hasJournalEntryToday,
            })
            setActive(next)
        }

        const initTimer = setTimeout(() => {
            if (!isAnyTourActive()) {
                startCadence()
                return
            }
            unsub = onTourStateChange((tourActive) => {
                if (!tourActive) {
                    delayTimer = setTimeout(startCadence, 600)
                    unsub?.()
                    unsub = null
                }
            })
        }, 1500)

        return () => {
            clearTimeout(initTimer)
            if (delayTimer) clearTimeout(delayTimer)
            unsub?.()
            releaseDailyCadence(claimRef.current)
            claimRef.current = null
        }
    }, [hasJournalEntryToday])

    const handlePrayerOpenChange = (open: boolean) => {
        if (open) return
        prayerDismiss.markDismissedToday()
        if (journalAppliesToday({
            journalHasEntryToday: hasJournalEntryToday,
            journalDismissedToday: journalDismiss.isDismissedToday(),
        })) {
            setTimeout(() => setActive('journal'), 400)
        } else {
            setActive(null)
        }
    }

    return (
        <>
            <DailyPrayerPopup
                open={active === 'prayer'}
                onOpenChange={handlePrayerOpenChange}
                viewerRole={viewerRole}
                partners={partners}
                content={content}
            />
            <DailyJournalPopup
                pairingId={pairingId}
                hasEntryToday={hasJournalEntryToday}
                leaderName={journalShareName}
                open={active === 'journal'}
                onOpenChange={(open) => {
                    if (!open) setActive(null)
                }}
            />
        </>
    )
}
