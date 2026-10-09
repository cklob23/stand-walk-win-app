'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { createClient } from '@/lib/supabase/client'
import {
    UNREAD_TO_LEADER_KEY,
    fetchUnreadToLeader,
} from '@/lib/unread-to-leader'

type UnreadToLeaderContextValue = {
    unreadByPairing: Record<string, number>
    setPairingUnread: (pairingId: string, count: number) => void
    bumpPairingUnread: (pairingId: string | null | undefined, delta: number) => void
    revalidate: () => void
}

const UnreadToLeaderContext = createContext<UnreadToLeaderContextValue>({
    unreadByPairing: {},
    setPairingUnread: () => {},
    bumpPairingUnread: () => {},
    revalidate: () => {},
})

export function useUnreadToLeader() {
    return useContext(UnreadToLeaderContext)
}

export function swrKeyForLeader(leaderId: string | null | undefined) {
    return leaderId ? [UNREAD_TO_LEADER_KEY, leaderId] as const : null
}

export function UnreadToLeaderProvider({
    leaderId,
    pairingIds,
    initial,
    children,
}: {
    leaderId: string | null
    pairingIds: string[]
    initial: Record<string, number>
    children: ReactNode
}) {
    const supabase = useMemo(() => createClient(), [])
    const key = swrKeyForLeader(leaderId)

    const { data, mutate } = useSWR(
        key,
        () => fetchUnreadToLeader(supabase, leaderId!, pairingIds),
        {
            fallbackData: initial,
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
        },
    )

    const unreadByPairing = data || initial || {}

    const setPairingUnread = useCallback((pairingId: string, count: number) => {
        void mutate(
            (prev) => ({ ...(prev || {}), [pairingId]: Math.max(0, count) }),
            { revalidate: true },
        )
    }, [mutate])

    const bumpPairingUnread = useCallback((pairingId: string | null | undefined, delta: number) => {
        if (!pairingId || delta === 0) return
        void mutate(
            (prev) => {
                const current = prev?.[pairingId] || 0
                return { ...(prev || {}), [pairingId]: Math.max(0, current + delta) }
            },
            { revalidate: false },
        )
    }, [mutate])

    const revalidate = useCallback(() => {
        void mutate()
    }, [mutate])

    useEffect(() => {
        const onMarked = (event: Event) => {
            const detail = (event as CustomEvent<{ pairingId?: string }>).detail
            if (detail?.pairingId) {
                void mutate(
                    (prev) => ({ ...(prev || {}), [detail.pairingId!]: 0 }),
                    { revalidate: true },
                )
                return
            }
            void mutate()
        }
        window.addEventListener('notifications-read', onMarked)
        return () => window.removeEventListener('notifications-read', onMarked)
    }, [mutate])

    const value = useMemo(
        () => ({ unreadByPairing, setPairingUnread, bumpPairingUnread, revalidate }),
        [unreadByPairing, setPairingUnread, bumpPairingUnread, revalidate],
    )

    return (
        <UnreadToLeaderContext.Provider value={value}>
            {children}
        </UnreadToLeaderContext.Provider>
    )
}

/** Call from places that already have a pairing id after a new inbound message. */
export function bumpUnreadToLeaderCache(leaderId: string, pairingId: string, delta: number) {
    const key = swrKeyForLeader(leaderId)
    if (!key) return
    void globalMutate(
        key,
        (prev: Record<string, number> | undefined) => ({
            ...(prev || {}),
            [pairingId]: Math.max(0, (prev?.[pairingId] || 0) + delta),
        }),
        { revalidate: false },
    )
}
