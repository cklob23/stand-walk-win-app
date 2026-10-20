/**
 * Guard for /dashboard (and week-page) load-time writes, and for the
 * selected-pairing cookie that SyncSelectedPairing used to stamp on fallback.
 *
 * After a pairing completes it drops out of the leader switcher. pickActivePairing
 * then falls back to another active learner. Meeting-progress, week-advance,
 * pairing-complete and journey_complete writes must not follow that fallback.
 *
 * Writes run only when the pairing was explicitly selected (?pairing= or a
 * cookie the user set by choosing a learner) or the leader has exactly one
 * active pairing. Learners are implicitly selecting their own pairing.
 */

export function shouldApplyDashboardLoadWrites(params: {
  shownPairingId: string | null | undefined
  urlPairingId?: string | null
  cookiePairingId?: string | null
  activePairingCount?: number
  role?: string | null
  /** @deprecated use urlPairingId + cookiePairingId */
  requestedPairingIds?: Array<string | null | undefined>
}): boolean {
  const shownPairingId = params.shownPairingId
  if (!shownPairingId) return false

  if (params.role === 'learner') return true

  const urlPairingId = firstId(params.urlPairingId, params.requestedPairingIds?.[0])
  const cookiePairingId = firstId(params.cookiePairingId, params.requestedPairingIds?.[1])

  if (urlPairingId && urlPairingId === shownPairingId) return true
  if (cookiePairingId && cookiePairingId === shownPairingId) return true
  if ((params.activePairingCount ?? 0) === 1) return true

  return false
}

/** The pairing id load-time writes may target, or null if they must no-op. */
export function resolveDashboardLoadWritePairingId(params: {
  shownPairingId: string | null | undefined
  urlPairingId?: string | null
  cookiePairingId?: string | null
  activePairingCount?: number
  role?: string | null
  requestedPairingIds?: Array<string | null | undefined>
}): string | null {
  if (!shouldApplyDashboardLoadWrites(params)) return null
  return params.shownPairingId ?? null
}

/**
 * Cookie value to persist, or null to leave the existing cookie alone.
 * Never stamps a fallback pairing over a completed / stale selection.
 */
export function resolveSelectedPairingCookieWrite(params: {
  shownPairingId: string | null | undefined
  urlPairingId?: string | null
  cookiePairingId?: string | null
  activePairingCount: number
}): string | null {
  const shown = params.shownPairingId || null
  const url = params.urlPairingId || null
  const cookie = params.cookiePairingId || null

  if (url && shown && url === shown) return shown
  if (cookie && shown && cookie === shown) return null
  if ((url && url !== shown) || (cookie && cookie !== shown)) return null
  if (shown && params.activePairingCount === 1) return shown
  return null
}

function firstId(
  primary?: string | null,
  fallback?: string | null,
): string | null {
  if (typeof primary === 'string' && primary.length > 0) return primary
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return null
}
