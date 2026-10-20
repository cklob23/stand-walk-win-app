/**
 * GraduationModal can be opened from AssignmentCard (last week-N assignment)
 * and from LearnerDashboard (isJourneyComplete). Share a per-pairing session
 * flag so it auto-opens exactly once.
 */

export const GRADUATION_MODAL_SEEN_PREFIX = 'graduation-modal-seen:'

export function graduationModalStorageKey(pairingId: string): string {
  return `${GRADUATION_MODAL_SEEN_PREFIX}${pairingId}`
}

function getSessionStorage(): Storage | null {
  try {
    if (typeof globalThis.sessionStorage === 'undefined') return null
    return globalThis.sessionStorage
  } catch {
    return null
  }
}

export function hasSeenGraduationModal(pairingId: string): boolean {
  if (!pairingId) return false
  const storage = getSessionStorage()
  if (!storage) return false
  return storage.getItem(graduationModalStorageKey(pairingId)) === '1'
}

export function markGraduationModalSeen(pairingId: string): void {
  if (!pairingId) return
  const storage = getSessionStorage()
  storage?.setItem(graduationModalStorageKey(pairingId), '1')
}

export function shouldAutoOpenGraduationModal(params: {
  isJourneyComplete: boolean
  alreadyShownThisMount: boolean
  alreadySeenForPairing: boolean
}): boolean {
  return params.isJourneyComplete && !params.alreadyShownThisMount && !params.alreadySeenForPairing
}
