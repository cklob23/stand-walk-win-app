import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    INITIAL_LISTEN_STATE,
    canBeginAutoAdvancePlayback,
    listenHighlightVerse,
    listenReducer,
    resolveListenStartIndex,
    versesBelongToLocation,
} from './bible-listen.ts'

function versesThrough(lastVerse: number) {
    return Array.from({ length: lastVerse }, (_, i) => ({ verse: i + 1 }))
}

describe('resolveListenStartIndex', () => {
    it('starts at the first verse when no offset is set', () => {
        assert.equal(resolveListenStartIndex({ verses: versesThrough(25) }), 0)
    })

    it('honors Listen from here on the current page', () => {
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                explicitStartVerse: 4,
            }),
            3
        )
    })

    it('does not carry verse 13 from the previous chapter onto John 2', () => {
        // Root cause: verse numbers restart each chapter, so findIndex(13)
        // succeeds on John 2 even though that offset belonged to John 1.
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                audioStartVerse: 13,
                pausedAtVerse: 13,
                offsetScope: { book: '43', chapter: 1 },
                currentBook: '43',
                currentChapter: 2,
            }),
            0
        )
    })

    it('starts at the first verse after a page or chapter turn', () => {
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                explicitStartVerse: 13,
                pausedAtVerse: 13,
                audioStartVerse: 13,
                forceFirstVerse: true,
                offsetScope: { book: '43', chapter: 1 },
                currentBook: '43',
                currentChapter: 2,
            }),
            0
        )
    })

    it('keeps a same-chapter pause or audio start verse', () => {
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                pausedAtVerse: 8,
                offsetScope: { book: '43', chapter: 2 },
                currentBook: '43',
                currentChapter: 2,
            }),
            7
        )
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                audioStartVerse: 13,
                offsetScope: { book: '43', chapter: 2 },
                currentBook: '43',
                currentChapter: 2,
            }),
            12
        )
    })

    it('falls back to the first verse when the offset is not on this page', () => {
        assert.equal(
            resolveListenStartIndex({
                verses: versesThrough(25),
                pausedAtVerse: 51,
                offsetScope: { book: '43', chapter: 2 },
                currentBook: '43',
                currentChapter: 2,
            }),
            0
        )
    })
})

describe('listenReducer chapter turn', () => {
    const peter5 = Array.from({ length: 14 }, (_, i) => ({
        book: '60',
        chapter: 5,
        verse: i + 1,
        text: `v${i + 1}`,
    }))

    it('does not start playback until verses for the target chapter arrive', () => {
        let state = listenReducer(INITIAL_LISTEN_STATE, {
            type: 'AWAIT_CHAPTER',
            location: { book: '60', chapter: 5 },
            sessionId: 2,
            hasNextChapter: true,
        })
        assert.equal(state.status, 'awaiting-verses')
        assert.equal(state.currentIndex, 0)
        assert.equal(listenHighlightVerse(state), null)

        state = listenReducer(state, {
            type: 'VERSES_READY',
            location: { book: '60', chapter: 5 },
            verses: [],
            hasNextChapter: true,
        })
        assert.equal(state.status, 'awaiting-verses')

        const staleChapter4 = Array.from({ length: 19 }, (_, i) => ({
            book: '60',
            chapter: 4,
            verse: i + 1,
        }))
        state = listenReducer(state, {
            type: 'VERSES_READY',
            location: { book: '60', chapter: 5 },
            verses: staleChapter4,
            hasNextChapter: true,
        })
        assert.equal(state.status, 'awaiting-verses')

        state = listenReducer(state, {
            type: 'VERSES_READY',
            location: { book: '60', chapter: 5 },
            verses: peter5,
            hasNextChapter: true,
        })
        assert.equal(state.status, 'loading-audio')
        assert.equal(state.currentIndex, 0)
        assert.equal(listenHighlightVerse(state), 1)
    })

    it('keeps highlight tied to currentIndex, not a leftover last verse', () => {
        let state = listenReducer(INITIAL_LISTEN_STATE, {
            type: 'USER_PLAY',
            location: { book: '60', chapter: 5 },
            verses: peter5,
            startIndex: 0,
            sessionId: 1,
            hasNextChapter: true,
        })
        state = listenReducer(state, { type: 'PLAYING', index: 0, sessionId: 1 })
        assert.equal(listenHighlightVerse(state), 1)
        state = listenReducer(state, { type: 'PLAYING', index: 13, sessionId: 1 })
        assert.equal(listenHighlightVerse(state), 14)
        state = listenReducer(state, { type: 'PLAYING', index: 13, sessionId: 99 })
        assert.equal(listenHighlightVerse(state), 14)
        assert.equal(state.currentIndex, 13)
    })

    it('re-arms auto-advance after chapter complete', () => {
        let state = listenReducer(INITIAL_LISTEN_STATE, {
            type: 'USER_PLAY',
            location: { book: '60', chapter: 5 },
            verses: peter5,
            startIndex: 0,
            sessionId: 1,
            hasNextChapter: true,
        })
        state = listenReducer(state, { type: 'PLAYING', index: 13, sessionId: 1 })
        state = listenReducer(state, { type: 'CHAPTER_COMPLETE', countdownSeconds: 3, sessionId: 1 })
        assert.equal(state.status, 'countdown')
        assert.equal(state.countdown, 3)
        state = listenReducer(state, { type: 'COUNTDOWN_TICK', sessionId: 1 })
        state = listenReducer(state, { type: 'COUNTDOWN_TICK', sessionId: 1 })
        state = listenReducer(state, { type: 'COUNTDOWN_TICK', sessionId: 1 })
        assert.equal(state.countdown, 0)
        state = listenReducer(state, {
            type: 'AWAIT_CHAPTER',
            location: { book: '60', chapter: 6 },
            sessionId: 2,
            hasNextChapter: false,
        })
        assert.equal(state.status, 'awaiting-verses')
        assert.equal(state.currentIndex, 0)
        assert.equal(state.location?.chapter, 6)
    })

    it('rejects auto-advance playback when verses are loading or belong to another chapter', () => {
        assert.equal(
            canBeginAutoAdvancePlayback({
                status: 'awaiting-verses',
                location: { book: '60', chapter: 5 },
                verses: peter5,
                versesLoading: true,
                target: { book: '60', chapter: 5 },
            }),
            false
        )
        assert.equal(
            versesBelongToLocation(
                [{ book: '60', chapter: 4, verse: 19, text: 'stale' }],
                { book: '60', chapter: 5 }
            ),
            false
        )
        assert.equal(
            canBeginAutoAdvancePlayback({
                status: 'awaiting-verses',
                location: { book: '60', chapter: 5 },
                verses: peter5,
                versesLoading: false,
                target: { book: '60', chapter: 5 },
            }),
            true
        )
    })
})
