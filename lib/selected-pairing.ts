'use server'

import { cookies } from 'next/headers'

const SELECTED_PAIRING_COOKIE = 'selected-pairing-id'

export async function getSelectedPairingId(): Promise<string | null> {
    const cookieStore = await cookies()
    return cookieStore.get(SELECTED_PAIRING_COOKIE)?.value || null
}

export async function setSelectedPairingId(pairingId: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(SELECTED_PAIRING_COOKIE, pairingId, {
        httpOnly: false, // Allow client-side reading for progress page
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    })
}

export async function clearSelectedPairingId(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.delete(SELECTED_PAIRING_COOKIE)
}
