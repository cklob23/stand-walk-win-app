import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ListenEngine } from './bible-listen-engine.ts'
import {
    type ListenLocation,
    type ListenState,
    type ListenVerse,
    listenHighlightVerse,
} from './bible-listen.ts'

function versesFor(book: string, chapter: number, lastVerse: number): ListenVerse[] {
    return Array.from({ length: lastVerse }, (_, i) => ({
        book,
        chapter,
        verse: i + 1,
        text: `Verse ${i + 1} of chapter ${chapter}.`,
    }))
}

type PendingFetch = {
    text: string
    resolve: (url: string) => void
    reject: (err: unknown) => void
    signal: AbortSignal
}

type Playing = {
    url: string
    onEnded: () => void
    onError: (err?: unknown) => void
}

function createHarness(options?: {
    chapters?: Record<number, { lastVerse: number; hasNext: boolean }>
    book?: string
    bookName?: string
}) {
    const book = options?.book ?? '60'
    const bookName = options?.bookName ?? '1 Peter'
    const chapterMeta = options?.chapters ?? {
        4: { lastVerse: 3, hasNext: true },
        5: { lastVerse: 14, hasNext: true },
        6: { lastVerse: 3, hasNext: false },
    }

    const timers: Array<() => void> = []
    const fetches: PendingFetch[] = []
    let playing: Playing | null = null
    const states: ListenState[] = []
    const errors: string[] = []
    const revoked: string[] = []
    let navigatedTo: ListenLocation | null = null

    const engine = new ListenEngine({
        fetchAudio: (text, signal) =>
            new Promise((resolve, reject) => {
                const entry: PendingFetch = { text, resolve, reject, signal }
                fetches.push(entry)
                signal.addEventListener(
                    'abort',
                    () => reject(new DOMException('Aborted', 'AbortError')),
                    { once: true }
                )
            }),
        playAudio: (url, handlers) => {
            playing = { url, onEnded: handlers.onEnded, onError: handlers.onError }
            return {
                stop: () => {
                    if (playing?.url === url) playing = null
                },
                pause: () => {},
                resume: () => {},
                setRate: () => {},
            }
        },
        onStateChange: (s) => {
            states.push(s)
        },
        onAutoAdvance: () => {
            const loc = engine.getState().location
            if (!loc) return null
            const nextChapter = loc.chapter + 1
            const meta = chapterMeta[nextChapter]
            if (!meta) return null
            const location = { book, chapter: nextChapter }
            navigatedTo = location
            return { location, hasNextChapter: meta.hasNext }
        },
        onError: (message) => {
            errors.push(message)
        },
        revokeUrl: (url) => {
            revoked.push(url)
        },
        schedule: (fn) => {
            timers.push(fn)
            return timers.length as unknown as ReturnType<typeof setTimeout>
        },
        cancelSchedule: () => {},
        countdownSeconds: 3,
        skipVerseNumbers: () => false,
    })

    function chapterVerses(chapter: number): ListenVerse[] {
        const meta = chapterMeta[chapter]
        return versesFor(book, chapter, meta.lastVerse)
    }

    async function flush(): Promise<void> {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
    }

    function openFetches(): PendingFetch[] {
        return fetches.filter((f) => !f.signal.aborted)
    }

    function fetchForVerse(chapter: number, verse: number): PendingFetch | undefined {
        const needle = verse === 1
            ? `${bookName} chapter ${chapter}. Verse ${verse}.`
            : `Verse ${verse}.`
        return openFetches().find((f) => f.text.includes(needle))
    }

    async function resolveVerse(chapter: number, verse: number): Promise<void> {
        await flush()
        const pending = fetchForVerse(chapter, verse)
        assert.ok(pending, `expected in-flight audio fetch for chapter ${chapter} verse ${verse}`)
        pending.resolve(`blob:${chapter}:${verse}`)
        await flush()
    }

    async function playThroughChapter(chapter: number): Promise<void> {
        const last = chapterMeta[chapter].lastVerse
        for (let verse = 1; verse <= last; verse++) {
            await resolveVerse(chapter, verse)
            const state = engine.getState()
            assert.equal(state.status, 'playing')
            assert.equal(state.currentIndex, verse - 1)
            assert.equal(listenHighlightVerse(state), verse)
            assert.ok(playing, `expected audio to be playing verse ${verse}`)
            const ended = playing.onEnded
            ended()
            await flush()
        }
    }

    async function tickCountdown(times = 3): Promise<void> {
        for (let i = 0; i < times; i++) {
            assert.ok(timers.length > 0, 'expected a countdown timer')
            const tick = timers.shift()!
            tick()
            await flush()
        }
    }

    return {
        engine,
        book,
        bookName,
        chapterVerses,
        chapterMeta,
        timers,
        fetches,
        errors,
        revoked,
        getPlaying: () => playing,
        getNavigatedTo: () => navigatedTo,
        flush,
        openFetches,
        resolveVerse,
        playThroughChapter,
        tickCountdown,
        startChapter(chapter: number, startIndex = 0) {
            const verses = chapterVerses(chapter)
            engine.play({
                location: { book, chapter },
                verses,
                bookName,
                startIndex,
                hasNextChapter: chapterMeta[chapter].hasNext,
            })
        },
        deliverVerses(chapter: number) {
            engine.notifyVerses({
                location: { book, chapter },
                verses: chapterVerses(chapter),
                versesLoading: false,
                bookName,
                hasNextChapter: chapterMeta[chapter].hasNext,
            })
        },
    }
}

describe('ListenEngine multi-chapter auto-advance', () => {
    it('waits for the new chapter verses, starts at index 0, and ignores user scroll', async () => {
        const h = createHarness()
        h.startChapter(4)
        await h.playThroughChapter(4)

        assert.equal(h.engine.getState().status, 'countdown')
        assert.equal(h.engine.getState().countdown, 3)
        assert.equal(listenHighlightVerse(h.engine.getState()), null)

        await h.tickCountdown(3)
        assert.equal(h.getNavigatedTo()?.chapter, 5)
        assert.equal(h.engine.getState().status, 'awaiting-verses')
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(h.engine.getState().verses.length, 0)
        assert.equal(h.getPlaying(), null)

        h.engine.notifyUserScroll(14)
        h.engine.notifyVerses({
            location: { book: h.book, chapter: 5 },
            verses: [],
            versesLoading: true,
            bookName: h.bookName,
            hasNextChapter: true,
        })
        assert.equal(h.engine.getState().status, 'awaiting-verses')
        assert.equal(h.getPlaying(), null)

        const stalePreviousChapter = versesFor(h.book, 4, 3)
        h.engine.notifyVerses({
            location: { book: h.book, chapter: 5 },
            verses: stalePreviousChapter,
            versesLoading: false,
            bookName: h.bookName,
            hasNextChapter: true,
        })
        assert.equal(h.engine.getState().status, 'awaiting-verses')

        h.engine.notifyUserScroll(14)
        h.deliverVerses(5)
        assert.equal(h.engine.getState().status, 'loading-audio')
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(listenHighlightVerse(h.engine.getState()), 1)

        await h.resolveVerse(5, 1)
        assert.equal(h.engine.getState().status, 'playing')
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(listenHighlightVerse(h.engine.getState()), 1)
        assert.equal(h.getPlaying()?.url, 'blob:5:1')
    })

    it('reads 1 Peter 5 from v1 through v14 after a delayed fetch, then auto-advances into the next chapter', async () => {
        const h = createHarness()
        h.startChapter(4)
        await h.playThroughChapter(4)
        await h.tickCountdown(3)

        h.engine.notifyUserScroll(14)
        await h.flush()
        h.deliverVerses(5)

        const played: number[] = []
        for (let verse = 1; verse <= 14; verse++) {
            h.engine.notifyUserScroll(14)
            await h.resolveVerse(5, verse)
            assert.equal(listenHighlightVerse(h.engine.getState()), verse)
            assert.equal(h.engine.getState().currentIndex, verse - 1)
            played.push(verse)
            h.getPlaying()!.onEnded()
            await h.flush()
        }

        assert.deepEqual(played, Array.from({ length: 14 }, (_, i) => i + 1))
        assert.equal(h.engine.getState().status, 'countdown')

        await h.tickCountdown(3)
        assert.equal(h.getNavigatedTo()?.chapter, 6)
        h.deliverVerses(6)
        await h.resolveVerse(6, 1)
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(listenHighlightVerse(h.engine.getState()), 1)
        assert.equal(h.engine.getState().location?.chapter, 6)
    })

    it('aborts in-flight audio from the previous chapter so a late response cannot play', async () => {
        const h = createHarness()
        h.startChapter(4)
        await h.flush()

        const first = h.openFetches()[0]
        assert.ok(first)
        assert.equal(h.engine.getState().status, 'loading-audio')

        h.engine.requestAutoAdvance({ book: h.book, chapter: 5 }, true)
        assert.ok(first.signal.aborted)
        assert.equal(h.engine.getState().status, 'awaiting-verses')
        assert.equal(h.getPlaying(), null)

        first.resolve('blob:stale-chapter-4')
        await h.flush()
        assert.equal(h.engine.getState().status, 'awaiting-verses')
        assert.equal(h.getPlaying(), null)
        assert.equal(listenHighlightVerse(h.engine.getState()), null)

        h.deliverVerses(5)
        await h.flush()
        assert.ok(h.openFetches().every((f) => !f.text.includes('chapter 4')))
        await h.resolveVerse(5, 1)
        assert.equal(h.getPlaying()?.url, 'blob:5:1')
        assert.equal(listenHighlightVerse(h.engine.getState()), 1)
    })

    it('does not skip ahead when play fails, so a late gesture cannot land on the last verse', async () => {
        const h = createHarness()
        h.startChapter(5, 0)
        await h.resolveVerse(5, 1)
        assert.equal(h.engine.getState().currentIndex, 0)

        h.getPlaying()!.onError(new Error('NotAllowedError'))
        await h.flush()

        assert.equal(h.engine.getState().status, 'error')
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(listenHighlightVerse(h.engine.getState()), null)
        assert.equal(h.errors.length, 1)
        assert.equal(h.getPlaying(), null)
        assert.equal(
            h.openFetches().filter((f) => f.text.includes('Verse 14.')).length,
            0
        )
    })

    it('ignores a stale onended handler after the chapter turn', async () => {
        const h = createHarness()
        h.startChapter(4)
        await h.resolveVerse(4, 1)
        const staleEnded = h.getPlaying()!.onEnded

        h.engine.requestAutoAdvance({ book: h.book, chapter: 5 }, true)
        staleEnded()
        await h.flush()

        assert.equal(h.engine.getState().status, 'awaiting-verses')
        assert.equal(h.engine.getState().currentIndex, 0)
        assert.equal(h.getPlaying(), null)
    })

    it('prefetches the next verse while the current verse is loading', async () => {
        const h = createHarness()
        h.startChapter(5)
        await h.flush()
        const open = h.openFetches().map((f) => f.text)
        assert.ok(open.some((t) => t.includes('Verse 1.')))
        assert.ok(open.some((t) => t.includes('Verse 2.')))
        assert.equal(
            open.filter((t) => t.includes('Verse 14.')).length,
            0
        )
    })
})
