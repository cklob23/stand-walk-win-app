'use client'

import { useEffect } from 'react'
import { setLocalDateCookie } from '@/lib/local-date'

/** Keeps a local-date cookie so journal "today" matches the device timezone on first SSR. */
export function SyncLocalDate() {
    useEffect(() => {
        const localDate = new Date().toLocaleDateString('en-CA')
        const existing = document.cookie
            .split('; ')
            .find(row => row.startsWith('local-date='))
            ?.split('=')[1]
        if (existing !== localDate) {
            void setLocalDateCookie(localDate)
        }
    }, [])
    return null
}
