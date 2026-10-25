import type { DailyPrayerContent } from './daily-prayer-content.ts'

export const DAILY_PRAYER_SESSION_PREFIX = 'swr-daily-prayer:'

export function dailyPrayerSessionKey(pairingId: string, dateKey: string): string {
    return `${DAILY_PRAYER_SESSION_PREFIX}${pairingId}:${dateKey}`
}

export function readDailyPrayerSession(
    pairingId: string,
    dateKey: string,
): DailyPrayerContent | null {
    if (typeof window === 'undefined' || !pairingId || !dateKey) return null
    try {
        const raw = sessionStorage.getItem(dailyPrayerSessionKey(pairingId, dateKey))
        if (!raw) return null
        const parsed = JSON.parse(raw) as DailyPrayerContent
        if (!parsed?.body || !parsed.scriptureRef) return null
        return parsed
    } catch {
        return null
    }
}

export function writeDailyPrayerSession(
    pairingId: string,
    dateKey: string,
    content: DailyPrayerContent,
): void {
    if (typeof window === 'undefined' || !pairingId || !dateKey) return
    try {
        sessionStorage.setItem(dailyPrayerSessionKey(pairingId, dateKey), JSON.stringify(content))
    } catch {
        // private mode
    }
}
