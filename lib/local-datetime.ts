import { format } from 'date-fns'

/** Parse a YYYY-MM-DD key as a local calendar date (not UTC midnight). */
export function parseLocalDateKey(dateKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey)
    if (!match) return null
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Format a YYYY-MM-DD key. Safe during SSR: both server and client
 * construct the same local calendar day, so `format()` text matches.
 * Do not use parseISO() here — that is UTC midnight and becomes the
 * previous day in US timezones (React #418).
 */
export function formatLocalDateKey(dateKey: string, pattern: string): string {
    const date = parseLocalDateKey(dateKey)
    if (!date) return dateKey
    return format(date, pattern)
}

/** Local YYYY-MM-DD for a Date (do not use toISOString().slice(0, 10)). */
export function toLocalDateKey(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}
