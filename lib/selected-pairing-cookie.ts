/** Client-side selected-pairing cookie. httpOnly is false so we can write
 *  this immediately on learner switch without awaiting a server action
 *  (which would refresh the current route and swallow router.push). */

export const SELECTED_PAIRING_COOKIE = 'selected-pairing-id'

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function readSelectedPairingCookie(): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${SELECTED_PAIRING_COOKIE}=`))
    if (!match) return null
    const value = match.slice(SELECTED_PAIRING_COOKIE.length + 1)
    return value ? decodeURIComponent(value) : null
}

export function writeSelectedPairingCookie(pairingId: string): void {
    if (typeof document === 'undefined') return
    if (!pairingId) return
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${SELECTED_PAIRING_COOKIE}=${encodeURIComponent(pairingId)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}
