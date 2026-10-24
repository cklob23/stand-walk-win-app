/** Shared yyyy-MM-dd helpers. Matches the journal popup en-CA local date. */

export const LOCAL_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isLocalDateKey(value: string | null | undefined): value is string {
    return typeof value === 'string' && LOCAL_DATE_KEY_RE.test(value)
}

export function utcDateKey(now: Date = new Date()): string {
    return now.toISOString().split('T')[0]
}

/**
 * URL date → device cookie (set on first client paint) → UTC fallback.
 * Same order as the journal page. Prefer the cookie so "today" after 8 PM ET
 * is still the viewer's local day, not the UTC date.
 */
export function resolveLocalDateKey(input: {
    urlDate?: string | null
    cookieDate?: string | null
    now?: Date
}): string {
    if (isLocalDateKey(input.urlDate)) return input.urlDate
    if (isLocalDateKey(input.cookieDate)) return input.cookieDate
    return utcDateKey(input.now)
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
