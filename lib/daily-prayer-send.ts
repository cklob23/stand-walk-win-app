import { DAILY_PRAYER_MESSAGE_PREFIX } from './daily-prayer-content.ts'
import { isLocalDateKey, utcDateKey } from './local-date-key.ts'

export function dailyPrayerSendKey(senderId: string, recipientId: string, localDate: string): string {
    return `${senderId}:${recipientId}:${localDate}`
}

/** Accept yesterday / today / tomorrow relative to UTC so evening ET is valid. */
export function isNearUtcToday(localDate: string, utcToday: string, slackDays = 1): boolean {
    const localMs = Date.parse(`${localDate}T00:00:00Z`)
    const utcMs = Date.parse(`${utcToday}T00:00:00Z`)
    if (Number.isNaN(localMs) || Number.isNaN(utcMs)) return false
    return Math.abs(localMs - utcMs) <= slackDays * 86_400_000
}

export function resolveClientLocalDate(input: {
    localDate?: string | null
    timezoneOffsetMinutes?: number
    now?: Date
}): { localDate: string; timezoneOffsetMinutes: number } {
    const now = input.now ?? new Date()
    const timezoneOffsetMinutes = isPlausibleTimezoneOffset(input.timezoneOffsetMinutes)
        ? input.timezoneOffsetMinutes
        : 0
    const computed = utcIsoToLocalDateKey(now.toISOString(), timezoneOffsetMinutes)
    if (isLocalDateKey(input.localDate) && isNearUtcToday(input.localDate, utcDateKey(now))) {
        return { localDate: input.localDate, timezoneOffsetMinutes }
    }
    return { localDate: computed, timezoneOffsetMinutes }
}

/** Convert a UTC timestamp to the viewer's local yyyy-MM-dd. */
export function utcIsoToLocalDateKey(iso: string, timezoneOffsetMinutes: number): string {
    const shifted = new Date(new Date(iso).getTime() - timezoneOffsetMinutes * 60_000)
    const year = shifted.getUTCFullYear()
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
    const day = String(shifted.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function isPlausibleTimezoneOffset(offsetMinutes: unknown): offsetMinutes is number {
    return typeof offsetMinutes === 'number' && Number.isFinite(offsetMinutes) && Math.abs(offsetMinutes) <= 16 * 60
}

export function alreadySentDailyPrayerToday(input: {
    localDate: string
    timezoneOffsetMinutes: number
    messages: { content: string; created_at: string }[]
}): boolean {
    if (!input.localDate) return false
    return input.messages.some((message) => {
        if (!message.content.startsWith(DAILY_PRAYER_MESSAGE_PREFIX)) return false
        return utcIsoToLocalDateKey(message.created_at, input.timezoneOffsetMinutes) === input.localDate
    })
}

const recentPrayerSends = new Map<string, number>()

export function rememberDailyPrayerSend(key: string, at: number = Date.now()): void {
    recentPrayerSends.set(key, at)
}

export function forgetDailyPrayerSend(key: string): void {
    recentPrayerSends.delete(key)
}

export function wasDailyPrayerSendRemembered(
    key: string,
    at: number = Date.now(),
    windowMs: number = 36 * 60 * 60 * 1000,
): boolean {
    const prior = recentPrayerSends.get(key)
    return prior != null && at - prior < windowMs
}

export function resetDailyPrayerSendsForTests(): void {
    recentPrayerSends.clear()
}
