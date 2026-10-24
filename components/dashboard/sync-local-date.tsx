'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { setLocalDateCookie } from '@/lib/local-date'
import { shouldRefreshForLocalDate } from '@/lib/local-date-key'

/** Keeps a local-date cookie so journal "today" matches the device timezone on first SSR. */
export function SyncLocalDate() {
    const router = useRouter()
    const refreshed = useRef(false)

    useEffect(() => {
        const localDate = new Date().toLocaleDateString('en-CA')
        const existing = document.cookie
            .split('; ')
            .find(row => row.startsWith('local-date='))
            ?.split('=')[1] || null
        if (!shouldRefreshForLocalDate(existing, localDate) || refreshed.current) return
        refreshed.current = true
        void setLocalDateCookie(localDate).then(() => {
            router.refresh()
        })
    }, [router])

    return null
}
