/** Unread messages sent TO the leader (not notifications, not learner count). */

export const UNREAD_TO_LEADER_KEY = 'unread-to-leader'

export type UnreadMessageRow = {
    pairing_id: string
    sender_id: string
}

export function tallyUnreadToLeader(
    rows: UnreadMessageRow[] | null | undefined,
    leaderId: string,
): Record<string, number> {
    const next: Record<string, number> = {}
    if (!rows || !leaderId) return next
    for (const row of rows) {
        if (!row.pairing_id || row.sender_id === leaderId) continue
        next[row.pairing_id] = (next[row.pairing_id] || 0) + 1
    }
    return next
}

export async function fetchUnreadToLeader(
    supabase: { from: (table: string) => any },
    leaderId: string,
    pairingIds: string[],
): Promise<Record<string, number>> {
    if (!leaderId || pairingIds.length === 0) return {}
    const { data } = await supabase
        .from('messages')
        .select('pairing_id, sender_id')
        .in('pairing_id', pairingIds)
        .eq('is_read', false)
        .neq('sender_id', leaderId)
    return tallyUnreadToLeader(data as UnreadMessageRow[] | null, leaderId)
}
