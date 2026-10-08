/**
 * Shared pairing resolution so layout, nav, and every dashboard page
 * agree on the same active pairing.
 *
 * Priority: URL ?pairing= (if it belongs to the user and has a partner)
 *        → selected-pairing cookie (same checks)
 *        → first active pairing with a partner
 *        → first pending pairing with a partner
 *
 * Pairings without a partner (unclaimed invite codes) are never used for
 * nav or page content — those IDs caused blank Messages/Schedule/Covenant
 * pages that then redirected home.
 */

export interface ResolvablePairing {
    id: string
    status?: string | null
    learner_id?: string | null
    leader_id?: string | null
    learner?: unknown
    leader?: unknown
}

export function pairingHasPartner(pairing: ResolvablePairing, role: 'leader' | 'learner' | string | null): boolean {
    if (role === 'leader') {
        if (pairing.learner_id) return true
        const learner = pairing.learner
        if (Array.isArray(learner)) return learner.length > 0 && !!learner[0]
        return !!learner
    }
    if (role === 'learner') {
        if (pairing.leader_id) return true
        const leader = pairing.leader
        if (Array.isArray(leader)) return leader.length > 0 && !!leader[0]
        return !!leader
    }
    return !!(pairing.learner_id || pairing.leader_id || pairing.learner || pairing.leader)
}

export function isUsablePairing(pairing: ResolvablePairing, role: 'leader' | 'learner' | string | null): boolean {
    const status = pairing.status || 'active'
    if (status !== 'active' && status !== 'pending') return false
    return pairingHasPartner(pairing, role)
}

export function pickActivePairing<T extends ResolvablePairing>(
    pairings: T[] | null | undefined,
    role: 'leader' | 'learner' | string | null,
    preferredIds: Array<string | null | undefined> = [],
): T | null {
    if (!pairings || pairings.length === 0) return null

    const usable = pairings.filter(p => isUsablePairing(p, role))
    const pool = usable.length > 0 ? usable : pairings

    for (const id of preferredIds) {
        if (!id) continue
        const match = pool.find(p => p.id === id)
        if (match) return match
    }

    return (
        pool.find(p => p.status === 'active' && pairingHasPartner(p, role)) ||
        pool.find(p => pairingHasPartner(p, role)) ||
        pool[0] ||
        null
    )
}

export function unwrapJoinedProfile<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null
    if (Array.isArray(value)) return value[0] ?? null
    return value
}
