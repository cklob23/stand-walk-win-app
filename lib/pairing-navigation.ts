/**
 * Stay on the current dashboard route when the leader switches learners,
 * swapping only the ?pairing= param (and keeping other query params).
 */
export function pathWithPairing(
    pathname: string,
    pairingId: string,
    currentSearch?: string | URLSearchParams | null,
): string {
    const params = new URLSearchParams(
        typeof currentSearch === 'string'
            ? currentSearch
            : currentSearch?.toString() || ''
    )
    params.set('pairing', pairingId)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
}
