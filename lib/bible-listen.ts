export type ListenVerse = {
    verse: number
    text?: string
    book?: string
    chapter?: number
}

export type ListenLocation = {
    book: string
    chapter: number
}

export type ListenStatus =
    | 'idle'
    | 'awaiting-verses'
    | 'loading-audio'
    | 'playing'
    | 'paused'
    | 'countdown'
    | 'error'

export type ListenState = {
    sessionId: number
    location: ListenLocation | null
    verses: ListenVerse[]
    status: ListenStatus
    /** Index into `verses`. Highlight always tracks this, never scroll position. */
    currentIndex: number
    countdown: number | null
    error: string | null
    /** True when this session should auto-advance after the last verse. */
    hasNextChapter: boolean
}

export const INITIAL_LISTEN_STATE: ListenState = {
    sessionId: 0,
    location: null,
    verses: [],
    status: 'idle',
    currentIndex: 0,
    countdown: null,
    error: null,
    hasNextChapter: false,
}

export type ListenAction =
    | {
          type: 'USER_PLAY'
          location: ListenLocation
          verses: ListenVerse[]
          startIndex: number
          sessionId: number
          hasNextChapter: boolean
      }
    | { type: 'AWAIT_CHAPTER'; location: ListenLocation; sessionId: number; hasNextChapter: boolean }
    | { type: 'VERSES_READY'; location: ListenLocation; verses: ListenVerse[]; hasNextChapter: boolean }
    | { type: 'AUDIO_LOADING'; index: number; sessionId: number }
    | { type: 'PLAYING'; index: number; sessionId: number }
    | { type: 'PAUSE' }
    | { type: 'RESUME' }
    | { type: 'CHAPTER_COMPLETE'; countdownSeconds: number; sessionId: number }
    | { type: 'COUNTDOWN_TICK'; sessionId: number }
    | { type: 'ERROR'; message: string; sessionId: number }
    | { type: 'STOP' }

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

export function listenKey(location: ListenLocation | null | undefined): string | null {
    if (!location) return null
    return `${location.book}:${location.chapter}`
}

export function locationsMatch(
    a: ListenLocation | null | undefined,
    b: ListenLocation | null | undefined
): boolean {
    if (!a || !b) return false
    return a.book === b.book && a.chapter === b.chapter
}

/**
 * True only when the verse payload belongs to the chapter we are about to
 * read. Stale SWR data from the previous chapter must not start playback.
 */
export function versesBelongToLocation(verses: ListenVerse[], location: ListenLocation): boolean {
    if (verses.length === 0) return false
    return verses.every((v) => {
        const chapterOk = v.chapter == null || Number(v.chapter) === Number(location.chapter)
        const bookOk = v.book == null || String(v.book) === String(location.book)
        return chapterOk && bookOk
    })
}

export function canBeginAutoAdvancePlayback(args: {
    status: ListenStatus
    location: ListenLocation | null
    verses: ListenVerse[]
    versesLoading: boolean
    target: ListenLocation
}): boolean {
    if (args.status !== 'awaiting-verses') return false
    if (args.versesLoading) return false
    if (!locationsMatch(args.location, args.target)) return false
    if (!versesBelongToLocation(args.verses, args.target)) return false
    return true
}

/** Highlight is the verse at the active playback index, never the scroll position. */
export function listenHighlightVerse(state: ListenState): number | null {
    if (
        state.status === 'idle' ||
        state.status === 'countdown' ||
        state.status === 'error' ||
        state.status === 'awaiting-verses'
    ) {
        return null
    }
    return state.verses[state.currentIndex]?.verse ?? null
}

export function listenProgress(state: ListenState): number {
    if (state.verses.length === 0) return 0
    if (state.status === 'countdown') return 1
    return state.currentIndex / state.verses.length
}

export function isListenAudioLoading(state: ListenState): boolean {
    return state.status === 'awaiting-verses' || state.status === 'loading-audio'
}

export function isListenPlaying(state: ListenState): boolean {
    return state.status === 'playing'
}

export function isListenPaused(state: ListenState): boolean {
    return state.status === 'paused'
}

function clampIndex(index: number, length: number): number {
    if (length <= 0) return 0
    if (index < 0) return 0
    if (index >= length) return 0
    return index
}

function ignoreStaleSession(state: ListenState, sessionId: number): boolean {
    return sessionId !== state.sessionId
}

export function listenReducer(state: ListenState, action: ListenAction): ListenState {
    switch (action.type) {
        case 'STOP':
            return { ...INITIAL_LISTEN_STATE, sessionId: state.sessionId }

        case 'USER_PLAY': {
            if (action.verses.length === 0) return state
            const startIndex = clampIndex(action.startIndex, action.verses.length)
            return {
                sessionId: action.sessionId,
                location: action.location,
                verses: action.verses,
                status: 'loading-audio',
                currentIndex: startIndex,
                countdown: null,
                error: null,
                hasNextChapter: action.hasNextChapter,
            }
        }

        case 'AWAIT_CHAPTER':
            return {
                sessionId: action.sessionId,
                location: action.location,
                verses: [],
                status: 'awaiting-verses',
                currentIndex: 0,
                countdown: null,
                error: null,
                hasNextChapter: action.hasNextChapter,
            }

        case 'VERSES_READY': {
            if (state.status !== 'awaiting-verses') return state
            if (!locationsMatch(state.location, action.location)) return state
            if (!versesBelongToLocation(action.verses, action.location)) return state
            return {
                ...state,
                verses: action.verses,
                status: 'loading-audio',
                currentIndex: 0,
                countdown: null,
                error: null,
                hasNextChapter: action.hasNextChapter,
            }
        }

        case 'AUDIO_LOADING': {
            if (ignoreStaleSession(state, action.sessionId)) return state
            if (state.status === 'idle' || state.status === 'countdown' || state.status === 'awaiting-verses') {
                return state
            }
            return {
                ...state,
                status: state.status === 'paused' ? 'paused' : 'loading-audio',
                currentIndex: clampIndex(action.index, state.verses.length),
                error: null,
            }
        }

        case 'PLAYING': {
            if (ignoreStaleSession(state, action.sessionId)) return state
            if (state.status === 'idle' || state.status === 'countdown' || state.status === 'awaiting-verses') {
                return state
            }
            return {
                ...state,
                status: 'playing',
                currentIndex: clampIndex(action.index, state.verses.length),
                error: null,
            }
        }

        case 'PAUSE':
            if (state.status !== 'playing' && state.status !== 'loading-audio') return state
            return { ...state, status: 'paused' }

        case 'RESUME':
            if (state.status !== 'paused') return state
            return { ...state, status: state.verses.length > 0 ? 'playing' : 'awaiting-verses' }

        case 'CHAPTER_COMPLETE': {
            if (ignoreStaleSession(state, action.sessionId)) return state
            if (!state.hasNextChapter) {
                return { ...INITIAL_LISTEN_STATE, sessionId: state.sessionId }
            }
            return {
                ...state,
                status: 'countdown',
                countdown: action.countdownSeconds,
                error: null,
            }
        }

        case 'COUNTDOWN_TICK': {
            if (ignoreStaleSession(state, action.sessionId)) return state
            if (state.status !== 'countdown' || state.countdown == null) return state
            const next = state.countdown - 1
            return { ...state, countdown: next }
        }

        case 'ERROR': {
            if (ignoreStaleSession(state, action.sessionId)) return state
            return { ...state, status: 'error', error: action.message }
        }

        default:
            return state
    }
}

export function buildListenUtterance(args: {
    verse: ListenVerse
    index: number
    bookName: string
    chapter: number
    skipVerseNumbers: boolean
}): string {
    const verseText = (args.verse.text || '').replace(/\n/g, ' ').trim()
    const isFirst = args.index === 0
    if (args.skipVerseNumbers) {
        return isFirst ? `${args.bookName} chapter ${args.chapter}. ${verseText}` : verseText
    }
    return isFirst
        ? `${args.bookName} chapter ${args.chapter}. Verse ${args.verse.verse}. ${verseText}`
        : `Verse ${args.verse.verse}. ${verseText}`
}

export function isAbortError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const name = 'name' in err ? String((err as { name?: unknown }).name) : ''
    return name === 'AbortError'
}
