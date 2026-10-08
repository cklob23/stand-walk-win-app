/** Shared unread-notification tallies so the bell and learner pills never diverge. */

export type UnreadNotificationRow = {
    id: string
    pairing_id: string | null
    type: string
}

export function tallyUnreadByPairing(rows: UnreadNotificationRow[] | null | undefined): Record<string, number> {
    const next: Record<string, number> = {}
    if (!rows) return next
    for (const row of rows) {
        if (!row.pairing_id) continue
        next[row.pairing_id] = (next[row.pairing_id] || 0) + 1
    }
    return next
}
