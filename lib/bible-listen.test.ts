import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveListenStartIndex } from './bible-listen.ts'

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
