'use client'

import { pathWithPairing } from '@/lib/pairing-navigation'
import { writeSelectedPairingCookie } from '@/lib/selected-pairing-cookie'

/**
 * Switch the active learner immediately:
 *  1. Write the cookie on the client (next request / bogus-URL fallback)
 *  2. router.push the current path with ?pairing= set
 *
 * Do NOT await setSelectedPairingId (server action) and do NOT
 * router.refresh() here. A server-action flight + refresh of the old URL
 * swallows the push — cookie updates, page and URL stay on the previous
 * learner. Messages looked "slow" for the same reason; Schedule / Covenant
 * / Week / Journal often never navigated at all.
 */
export function navigateToPairing(
    router: { push: (href: string) => void },
    pathname: string,
    pairingId: string,
    currentSearch?: string | URLSearchParams | null,
): string {
    const href = pathWithPairing(pathname, pairingId, currentSearch)
    writeSelectedPairingCookie(pairingId)
    router.push(href)
    return href
}
