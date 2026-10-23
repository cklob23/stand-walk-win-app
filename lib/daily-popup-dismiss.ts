/**
 * Once-per-day dismiss storage shared by Daily Prayer and Daily Journal popups.
 * Mirrors the original journal pattern: local yyyy-MM-dd (en-CA) in
 * localStorage + sessionStorage + an in-memory flag for the tab.
 */

export function localDateKey(now: Date = new Date()): string {
    return now.toLocaleDateString('en-CA')
}

export interface DailyDismissStore {
    readonly lsKey: string
    readonly ssKey: string
    isDismissedToday(now?: Date): boolean
    markDismissedToday(now?: Date): void
    resetForTests(): void
}

function readStoredDate(lsKey: string, ssKey: string): string | null {
    if (typeof window === 'undefined') return null
    try {
        return localStorage.getItem(lsKey) || sessionStorage.getItem(ssKey)
    } catch {
        return null
    }
}

function writeStoredDate(lsKey: string, ssKey: string, dateKey: string): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(lsKey, dateKey)
        sessionStorage.setItem(ssKey, dateKey)
    } catch {
        // private mode / blocked storage — in-memory flag still holds for the tab
    }
}

export function createDailyDismissStore(lsKey: string, ssKey: string): DailyDismissStore {
    let dismissedThisSession = false

    return {
        lsKey,
        ssKey,
        isDismissedToday(now: Date = new Date()): boolean {
            if (dismissedThisSession) return true
            const today = localDateKey(now)
            const stored = readStoredDate(lsKey, ssKey)
            if (stored === today) {
                dismissedThisSession = true
                return true
            }
            return false
        },
        markDismissedToday(now: Date = new Date()): void {
            dismissedThisSession = true
            writeStoredDate(lsKey, ssKey, localDateKey(now))
        },
        resetForTests(): void {
            dismissedThisSession = false
            if (typeof window === 'undefined') return
            try {
                localStorage.removeItem(lsKey)
                sessionStorage.removeItem(ssKey)
            } catch {
                // ignore
            }
        },
    }
}

export const journalDismiss = createDailyDismissStore(
    'swr-journal-dismissed',
    'swr-journal-dismissed-session',
)

export const prayerDismiss = createDailyDismissStore(
    'swr-daily-prayer-dismissed',
    'swr-daily-prayer-dismissed-session',
)
