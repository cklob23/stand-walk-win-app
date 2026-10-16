export type ListenVerse = {
    verse: number
}

export type ResolveListenStartIndexArgs = {
    verses: ListenVerse[]
    /** Explicit start from "Listen from here" or a caller-provided verse. */
    explicitStartVerse?: number | null
    /** Verse the user paused on, only valid for the current chapter. */
    pausedAtVerse?: number | null
    /** Settings dropdown start verse, only valid for the current chapter. */
    audioStartVerse?: number | null
    /**
     * After a page or chapter turn, ignore leftover offsets and start at the
     * first verse on the new page (or the next unread verse in order).
     */
    forceFirstVerse?: boolean
    /**
     * Book/chapter the paused and audio-start offsets belong to. If this does
     * not match the page we are about to read, those offsets are stale.
     */
    offsetScope?: { book: string | null; chapter: number | null } | null
    currentBook?: string | null
    currentChapter?: number | null
}

function findVerseIndex(verses: ListenVerse[], verse: number | null | undefined): number {
    if (verse == null || !Number.isFinite(verse)) return -1
    return verses.findIndex((v) => v.verse === verse)
}

function offsetsBelongToCurrentPage(
    offsetScope: ResolveListenStartIndexArgs['offsetScope'],
    currentBook?: string | null,
    currentChapter?: number | null
): boolean {
    if (!offsetScope) return true
    if (offsetScope.book !== currentBook) return false
    if (offsetScope.chapter !== currentChapter) return false
    return true
}

/**
 * Resolve the verse-array index where Listen/TTS should begin.
 *
 * Verse numbers restart at 1 in every chapter, so a leftover start of 13 from
 * John 1 must not be applied to John 2. Highlight tracks this index, so a
 * wrong index skips the verses at the top of the new page.
 */
export function resolveListenStartIndex({
    verses,
    explicitStartVerse = null,
    pausedAtVerse = null,
    audioStartVerse = null,
    forceFirstVerse = false,
    offsetScope = null,
    currentBook = null,
    currentChapter = null,
}: ResolveListenStartIndexArgs): number {
    if (verses.length === 0) return 0
    if (forceFirstVerse) return 0

    const explicitIdx = findVerseIndex(verses, explicitStartVerse)
    if (explicitIdx >= 0) return explicitIdx

    if (!offsetsBelongToCurrentPage(offsetScope, currentBook, currentChapter)) {
        return 0
    }

    const pausedIdx = findVerseIndex(verses, pausedAtVerse)
    if (pausedIdx >= 0) return pausedIdx

    const audioIdx = findVerseIndex(verses, audioStartVerse)
    if (audioIdx >= 0) return audioIdx

    return 0
}
