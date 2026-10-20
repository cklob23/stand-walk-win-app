'use client'

import { useEffect } from 'react'
import { resolveSelectedPairingCookieWrite } from '@/lib/dashboard-load-writes'
import { readSelectedPairingCookie, writeSelectedPairingCookie } from '@/lib/selected-pairing-cookie'

/**
 * Keeps the selected-pairing cookie aligned with an explicit learner choice
 * (URL after a switcher click, or the only active pairing).
 *
 * Never overwrites a completed / stale cookie with a fallback pairing — that
 * rewrite was what let the next /dashboard load pass the write guard.
 */
export function SyncSelectedPairing({
  pairingId,
  activePairingCount = 0,
}: {
  pairingId: string | null | undefined
  activePairingCount?: number
}) {
  useEffect(() => {
    const urlPairing = new URLSearchParams(window.location.search).get('pairing')
    const cookie = readSelectedPairingCookie()
    const next = resolveSelectedPairingCookieWrite({
      shownPairingId: pairingId,
      urlPairingId: urlPairing,
      cookiePairingId: cookie,
      activePairingCount,
    })
    if (next && next !== cookie) {
      writeSelectedPairingCookie(next)
    }
  }, [pairingId, activePairingCount])

  return null
}
