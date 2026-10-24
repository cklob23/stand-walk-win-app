import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createDailyDismissStore, localDateKey } from './daily-popup-dismiss.ts'

function memoryStorage() {
    const map = new Map<string, string>()
    return {
        getItem(key: string) {
            return map.has(key) ? map.get(key)! : null
        },
        setItem(key: string, value: string) {
            map.set(key, value)
        },
        removeItem(key: string) {
            map.delete(key)
        },
        clear() {
            map.clear()
        },
        key(index: number) {
            return [...map.keys()][index] ?? null
        },
        get length() {
            return map.size
        },
    } satisfies Storage
}

describe('daily popup dismiss store', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: memoryStorage(),
        })
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: memoryStorage(),
        })
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: globalThis,
        })
    })

    it('uses en-CA yyyy-MM-dd keys', () => {
        const date = new Date('2026-10-23T15:00:00')
        assert.match(localDateKey(date), /^\d{4}-\d{2}-\d{2}$/)
    })

    it('is not dismissed until marked', () => {
        const store = createDailyDismissStore('swr-daily-prayer-dismissed', 'swr-daily-prayer-dismissed-session')
        assert.equal(store.isDismissedToday(), false)
        store.markDismissedToday()
        assert.equal(store.isDismissedToday(), true)
        assert.equal(localStorage.getItem('swr-daily-prayer-dismissed'), localDateKey())
        assert.equal(sessionStorage.getItem('swr-daily-prayer-dismissed-session'), localDateKey())
    })

    it('treats a stored date from a previous day as expired', () => {
        const store = createDailyDismissStore('swr-journal-dismissed', 'swr-journal-dismissed-session')
        localStorage.setItem('swr-journal-dismissed', '2026-01-01')
        assert.equal(store.isDismissedToday(new Date('2026-10-23T12:00:00')), false)
    })

    it('keeps prayer and journal keys independent', () => {
        const prayer = createDailyDismissStore('swr-daily-prayer-dismissed', 'swr-daily-prayer-dismissed-session')
        const journal = createDailyDismissStore('swr-journal-dismissed', 'swr-journal-dismissed-session')
        prayer.markDismissedToday()
        assert.equal(prayer.isDismissedToday(), true)
        assert.equal(journal.isDismissedToday(), false)
    })
})
