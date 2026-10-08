'use client'

import { useEffect } from 'react'
import { readSelectedPairingCookie, writeSelectedPairingCookie } from '@/lib/selected-pairing-cookie'

/**
 * Keeps the selected-pairing cookie aligned with the pairing the page is
 * actually showing. Prefer the URL (source of truth after a learner switch)
 * so a stale layout cookie cannot overwrite a just-pushed ?pairing=.
 *
 * Writes the cookie on the client only — a server action here would
 * refresh the current route and can cancel an in-flight router.push.
 */
export function SyncSelectedPairing({ pairingId }: { pairingId: string | null | undefined }) {
    useEffect(() => {
        const urlPairing = new URLSearchParams(window.location.search).get('pairing')
        const target = urlPairing || pairingId
        if (!target) return
        if (readSelectedPairingCookie() !== target) {
            writeSelectedPairingCookie(target)
        }
    }, [pairingId])

    return null
}
