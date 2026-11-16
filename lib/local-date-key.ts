/** Shared yyyy-MM-dd helpers. Matches the journal popup en-CA local date. */

export const LOCAL_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
export const DEFAULT_VIEWER_TIMEZONE = 'America/New_York'

export function isLocalDateKey(value: string | null | undefined): value is string {
    return typeof value === 'string' && LOCAL_DATE_KEY_RE.test(value)
}

export function utcDateKey(now: Date = new Date()): string {
    return now.toISOString().split('T')[0]
}

/** yyyy-MM-dd in the given IANA zone. First-visit SSR uses Eastern, not UTC. */
export function zonedDateKey(now: Date = new Date(), timeZone = DEFAULT_VIEWER_TIMEZONE): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
    return utcDateKey(now)
}

/**
 * URL date → device cookie (set on first client paint) → America/New_York.
 * Same order as the journal page. Prefer the cookie so a traveler's device
 * day wins after first paint. With no cookie, 9 PM ET must still be today,
 * not the next UTC date, or the prayer topic can jump mid-evening.
 */
export function resolveLocalDateKey(input: {
    urlDate?: string | null
    cookieDate?: string | null
    now?: Date
}): string {
    if (isLocalDateKey(input.urlDate)) return input.urlDate
    if (isLocalDateKey(input.cookieDate)) return input.cookieDate
    return zonedDateKey(input.now)
}

/** True when the device local date is ahead of (or missing) the cookie. */
export function shouldRefreshForLocalDate(
    cookieDate: string | null | undefined,
    deviceDate: string,
): boolean {
    return isLocalDateKey(deviceDate) && cookieDate !== deviceDate
}

/**
 * Journal-today must follow the device date, not a stale cookie or UTC.
 * If the server queried a different day, that entry is not "today".
 */
export function resolveJournalHasEntryToday(input: {
    queriedDate?: string | null
    hasEntryOnQueriedDate: boolean
    deviceDate: string
}): boolean {
    if (!isLocalDateKey(input.deviceDate) || !isLocalDateKey(input.queriedDate)) {
        return false
    }
    if (input.queriedDate !== input.deviceDate) return false
    return input.hasEntryOnQueriedDate
}
