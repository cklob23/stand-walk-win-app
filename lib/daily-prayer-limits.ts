import type { DailyPrayerContent } from './daily-prayer-content.ts'
import { dailyPrayerCacheKey } from './daily-prayer-generate.ts'

export const DAILY_PRAYER_USER_RATE_MS = 8000

const aiAttempts = new Map<string, number>()
const userSlots = new Map<string, number>()
const memoryPrayers = new Map<string, DailyPrayerContent>()

export function claimDailyPrayerAiAttempt(
    userId: string,
    pairingId: string,
    localDate: string,
    now: number = Date.now(),
): boolean {
    const key = dailyPrayerCacheKey(userId, pairingId, localDate)
    if (aiAttempts.has(key)) return false
    aiAttempts.set(key, now)
    return true
}

export function hasDailyPrayerAiAttempt(userId: string, pairingId: string, localDate: string): boolean {
    return aiAttempts.has(dailyPrayerCacheKey(userId, pairingId, localDate))
}

export function claimDailyPrayerAiUserSlot(
    userId: string,
    now: number = Date.now(),
    windowMs: number = DAILY_PRAYER_USER_RATE_MS,
): boolean {
    const prior = userSlots.get(userId)
    if (prior != null && now - prior < windowMs) return false
    userSlots.set(userId, now)
    return true
}

export function rememberMemoryDailyPrayer(
    userId: string,
    pairingId: string,
    localDate: string,
    content: DailyPrayerContent,
): void {
    memoryPrayers.set(dailyPrayerCacheKey(userId, pairingId, localDate), content)
}

export function loadMemoryDailyPrayer(
    userId: string,
    pairingId: string,
    localDate: string,
): DailyPrayerContent | null {
    return memoryPrayers.get(dailyPrayerCacheKey(userId, pairingId, localDate)) || null
}

export function resetDailyPrayerLimitsForTests(): void {
    aiAttempts.clear()
    userSlots.clear()
    memoryPrayers.clear()
}

export function pairingPartnerId(
    pairing: { leader_id: string; learner_id: string | null },
    viewerId: string,
): string | null {
    if (pairing.leader_id === viewerId) return pairing.learner_id
    if (pairing.learner_id === viewerId) return pairing.leader_id
    return null
}

/** Never persist a partner_id that is not the other person in this pairing. */
export function sanitizedPartnerId(
    pairing: { leader_id: string; learner_id: string | null },
    viewerId: string,
    requestedId?: string | null,
): string | null {
    const expected = pairingPartnerId(pairing, viewerId)
    if (!expected) return null
    if (requestedId && requestedId !== expected) return expected
    return requestedId || expected
}

export function pickSendPrayerContent(input: {
    cached: Pick<DailyPrayerContent, 'body' | 'scriptureText' | 'scriptureRef'> | null
    displayed: Pick<DailyPrayerContent, 'body' | 'scriptureText' | 'scriptureRef'>
}): Pick<DailyPrayerContent, 'body' | 'scriptureText' | 'scriptureRef'> {
    if (input.cached?.body) return input.cached
    return input.displayed
}

export function planEnsureDailyPrayer(input: {
    aiCached: boolean
    allowGenerate: boolean
    claimedAttempt: boolean
    rateLimited: boolean
}): 'cache' | 'generate' | 'catalog' {
    if (input.aiCached) return 'cache'
    if (input.allowGenerate && input.claimedAttempt && !input.rateLimited) return 'generate'
    return 'catalog'
}
