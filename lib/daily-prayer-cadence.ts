/**
 * Daily Prayer + Daily Journal coexistence.
 * Never stack two dialogs. Prayer shows first when due; journal may follow
 * after prayer closes. Each has its own once-per-day key.
 */

export type DailyPopupKind = 'prayer' | 'journal' | null

export interface DailyCadenceInput {
    tourActive: boolean
    prayerDismissedToday: boolean
    /** True after this session's prayer dialog has closed (or decided not to show). */
    prayerSettledThisSession: boolean
    journalDismissedToday: boolean
    journalHasEntryToday: boolean
}

export function nextDailyPopup(input: DailyCadenceInput): DailyPopupKind {
    if (input.tourActive) return null

    const prayerDue = !input.prayerDismissedToday && !input.prayerSettledThisSession
    if (prayerDue) return 'prayer'

    const journalDue = !input.journalHasEntryToday && !input.journalDismissedToday
    if (journalDue) return 'journal'

    return null
}

export function journalAppliesToday(input: {
    journalHasEntryToday: boolean
    journalDismissedToday: boolean
}): boolean {
    return !input.journalHasEntryToday && !input.journalDismissedToday
}

/** First caller wins so split-screen remounts cannot stack two copies. */
let cadenceOwner: symbol | null = null

export function claimDailyCadence(): symbol | null {
    if (cadenceOwner) return null
    const token = Symbol('daily-cadence')
    cadenceOwner = token
    return token
}

export function releaseDailyCadence(token: symbol | null): void {
    if (token && cadenceOwner === token) cadenceOwner = null
}

export function resetDailyCadenceClaimForTests(): void {
    cadenceOwner = null
}
