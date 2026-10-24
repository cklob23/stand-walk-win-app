'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { isAnyTourActive, onTourStateChange } from '@/hooks/use-feature-tour'
import { journalDismiss, prayerDismiss } from '@/lib/daily-popup-dismiss'
import {
    claimDailyCadence,
    journalAppliesToday,
    nextDailyPopup,
    prayerCloseTransition,
    releaseDailyCadence,
} from '@/lib/daily-prayer-cadence'
import {
    buildDailyPrayer,
    type DailyPrayerInput,
    type DailyPrayerPartner,
} from '@/lib/daily-prayer-content'
import { resolveJournalHasEntryToday } from '@/lib/local-date-key'
import { DailyJournalPopup } from '@/components/journal/daily-journal-popup'
import { DailyPrayerPopup } from '@/components/journal/daily-prayer-popup'

export interface DailyPopupsProps {
    pairingId: string
    hasJournalEntryToday: boolean
    /** Date the server used for hasJournalEntryToday (yyyy-MM-dd). */
    journalTodayKey?: string | null
    journalShareName: string
    viewerRole: 'leader' | 'learner'
    partners: DailyPrayerPartner[]
    prayerInput: Omit<DailyPrayerInput, 'dateKey' | 'partnerName'>
}

export function DailyPopups({
    pairingId,
    hasJournalEntryToday,
    journalTodayKey,
    journalShareName,
    viewerRole,
    partners,
    prayerInput,
}: DailyPopupsProps) {
    const [active, setActive] = useState<'prayer' | 'journal' | null>(null)
    const [deviceDate, setDeviceDate] = useState('')
    const claimRef = useRef<symbol | null>(null)

    useEffect(() => {
        setDeviceDate(new Date().toLocaleDateString('en-CA'))
    }, [])

    const journalHasEntryOnDeviceToday = resolveJournalHasEntryToday({
        queriedDate: journalTodayKey,
        hasEntryOnQueriedDate: hasJournalEntryToday,
        deviceDate,
    })

    const content = useMemo(() => {
        const dateKey = deviceDate || new Date().toLocaleDateString('en-CA')
        const currentPartner = partners.find((partner) => partner.pairingId === pairingId) || partners[0]
        return buildDailyPrayer({
            ...prayerInput,
            dateKey,
            partnerName: currentPartner?.name || null,
        })
    }, [deviceDate, pairingId, partners, prayerInput])

    useEffect(() => {
        if (!deviceDate) return
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
                journalHasEntryToday: journalHasEntryOnDeviceToday,
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
    }, [deviceDate, hasJournalEntryToday, journalHasEntryOnDeviceToday, journalTodayKey])

    const handlePrayerOpenChange = (open: boolean) => {
        if (open) return
        prayerDismiss.markDismissedToday()
        const journalDue = journalAppliesToday({
            journalHasEntryToday: journalHasEntryOnDeviceToday,
            journalDismissedToday: journalDismiss.isDismissedToday(),
        })
        const { immediate, followUp } = prayerCloseTransition(journalDue)
        setActive(immediate)
        if (followUp) {
            setTimeout(() => setActive(followUp), 400)
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
                hasEntryToday={journalHasEntryOnDeviceToday}
                leaderName={journalShareName}
                open={active === 'journal'}
                onOpenChange={(open) => {
                    if (!open) setActive(null)
                }}
            />
        </>
    )
}
