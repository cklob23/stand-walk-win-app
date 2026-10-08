'use server'

import { cookies } from 'next/headers'

const LOCAL_DATE_COOKIE = 'local-date'

export async function getLocalDateCookie(): Promise<string | null> {
    const cookieStore = await cookies()
    const value = cookieStore.get(LOCAL_DATE_COOKIE)?.value || null
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function setLocalDateCookie(date: string): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    const cookieStore = await cookies()
    cookieStore.set(LOCAL_DATE_COOKIE, date, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 2,
        path: '/',
    })
}
