/**
 * Guard for /dashboard (and week-page) load-time writes.
 *
 * After a pairing completes it drops out of the leader switcher. pickActivePairing
 * then falls back to another active learner. Meeting-progress upserts and
 * week-advance updates must not follow that fallback — they may only target
 * the pairing the page is actually showing, and only when that pairing was
 * explicitly selected (URL / cookie) or is the sole shown pairing because
 * nothing else was requested.
 */

export function shouldApplyDashboardLoadWrites(params: {
  shownPairingId: string | null | undefined
  requestedPairingIds?: Array<string | null | undefined>
}): boolean {
  const shownPairingId = params.shownPairingId
  if (!shownPairingId) return false

  const requested = (params.requestedPairingIds || []).filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )

  // Learner dashboards and a first visit have no ?pairing= / cookie. Writes
  // apply only to the pairing being rendered.
  if (requested.length === 0) return true

  // An explicit URL or cookie that does not match the rendered pairing means
  // we fell back (completed pairing, stale id). Do not mutate the fallback.
  return requested.includes(shownPairingId)
}

/** The pairing id load-time writes may target, or null if they must no-op. */
export function resolveDashboardLoadWritePairingId(params: {
  shownPairingId: string | null | undefined
  requestedPairingIds?: Array<string | null | undefined>
}): string | null {
  if (!shouldApplyDashboardLoadWrites(params)) return null
  return params.shownPairingId ?? null
}
