'use client'

import { useEffect } from 'react'
import { setSelectedPairingId } from '@/lib/selected-pairing'

/**
 * Keeps the selected-pairing cookie aligned with the pairing the server
 * actually rendered, so nav links and later page loads stay in sync.
 */
export function SyncSelectedPairing({ pairingId }: { pairingId: string | null | undefined }) {
    useEffect(() => {
        if (!pairingId) return
        const current = document.cookie
            .split('; ')
            .find(row => row.startsWith('selected-pairing-id='))
            ?.split('=')[1]
        if (current !== pairingId) {
            void setSelectedPairingId(pairingId)
        }
    }, [pairingId])

    return null
}
