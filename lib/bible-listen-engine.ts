import {
    type ListenLocation,
    type ListenState,
    type ListenVerse,
    INITIAL_LISTEN_STATE,
    buildListenUtterance,
    canBeginAutoAdvancePlayback,
    isAbortError,
    listenReducer,
    versesBelongToLocation,
} from './bible-listen.ts'

export type ListenPlayerHandle = {
    stop: () => void
    pause: () => void
    resume: () => void
    setRate: (rate: number) => void
}

export type ListenEngineDeps = {
    fetchAudio: (text: string, signal: AbortSignal) => Promise<string>
    playAudio: (
        url: string,
        handlers: { onEnded: () => void; onError: (err?: unknown) => void }
    ) => ListenPlayerHandle
    onStateChange?: (state: ListenState) => void
    /**
     * Called when the countdown reaches 0. Return the next book+chapter to
     * wait for, or null if there is no next chapter. Do not start playback
     * here; the engine waits for matching verses, then starts at index 0.
     */
    onAutoAdvance: () => { location: ListenLocation; hasNextChapter: boolean } | null
    onError?: (message: string) => void
    revokeUrl?: (url: string) => void
    schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
    cancelSchedule?: (id: ReturnType<typeof setTimeout>) => void
    countdownSeconds?: number
    skipVerseNumbers?: () => boolean
    speechRate?: () => number
}

export type PlayChapterArgs = {
    location: ListenLocation
    verses: ListenVerse[]
    bookName: string
    startIndex: number
    hasNextChapter: boolean
}

export type NotifyVersesArgs = {
    location: ListenLocation
    verses: ListenVerse[]
    versesLoading: boolean
    bookName: string
    hasNextChapter: boolean
}

type ChapterContext = {
    bookName: string
    hasNextChapter: boolean
}

/**
 * Single source of truth for Listen/TTS. Keyed by book+chapter via the
 * reducer. A generation token plus AbortController discard in-flight audio
 * from a previous chapter so a late ElevenLabs response cannot play or skip
 * verses on the new page.
 */
export class ListenEngine {
    private state: ListenState = INITIAL_LISTEN_STATE
    private readonly deps: ListenEngineDeps
    private abort: AbortController | null = null
    private player: ListenPlayerHandle | null = null
    private countdownTimer: ReturnType<typeof setTimeout> | null = null
    private audioCache = new Map<string, string>()
    private inflight = new Map<string, Promise<string>>()
    private context: ChapterContext = { bookName: '', hasNextChapter: false }
    private disposed = false

    constructor(deps: ListenEngineDeps) {
        this.deps = deps
    }

    getState(): ListenState {
        return this.state
    }

    /**
     * User scroll must never change the start index or current index.
     * Exposed so tests can simulate the 1 Peter 5:14 scroll during a delay.
     */
    notifyUserScroll(_visibleVerse?: number): void {
        return
    }

    play(args: PlayChapterArgs): void {
        if (this.disposed) return
        if (args.verses.length === 0) return
        if (!versesBelongToLocation(args.verses, args.location)) return

        this.bumpSession()
        this.context = { bookName: args.bookName, hasNextChapter: args.hasNextChapter }
        this.dispatch({
            type: 'USER_PLAY',
            location: args.location,
            verses: args.verses,
            startIndex: args.startIndex,
            sessionId: this.state.sessionId,
            hasNextChapter: args.hasNextChapter,
        })
        void this.playIndex(this.state.currentIndex, this.state.sessionId)
    }

    /**
     * Abort current audio and wait for the next chapter's verses. Playback
     * always resumes at index 0 once matching verses arrive.
     */
    requestAutoAdvance(location: ListenLocation, hasNextChapter: boolean): void {
        if (this.disposed) return
        this.bumpSession()
        this.context = { ...this.context, hasNextChapter }
        this.dispatch({
            type: 'AWAIT_CHAPTER',
            location,
            sessionId: this.state.sessionId,
            hasNextChapter,
        })
    }

    notifyVerses(args: NotifyVersesArgs): void {
        if (this.disposed) return
        const { location, verses, versesLoading, bookName, hasNextChapter } = args
        if (
            !canBeginAutoAdvancePlayback({
                status: this.state.status,
                location: this.state.location,
                verses,
                versesLoading,
                target: location,
            })
        ) {
            return
        }
        this.context = { bookName, hasNextChapter }
        this.dispatch({
            type: 'VERSES_READY',
            location,
            verses,
            hasNextChapter,
        })
        void this.playIndex(0, this.state.sessionId)
    }

    pause(): void {
        if (this.state.status !== 'playing' && this.state.status !== 'loading-audio') return
        this.player?.pause()
        this.dispatch({ type: 'PAUSE' })
    }

    resume(): void {
        if (this.state.status !== 'paused') return
        this.dispatch({ type: 'RESUME' })
        if (this.player) {
            this.player.resume()
            return
        }
        void this.playIndex(this.state.currentIndex, this.state.sessionId)
    }

    stop(): void {
        this.bumpSession()
        this.dispatch({ type: 'STOP' })
    }

    setRate(rate: number): void {
        this.player?.setRate(rate)
    }

    dispose(): void {
        this.disposed = true
        this.bumpSession()
        this.dispatch({ type: 'STOP' })
    }

    private dispatch(action: Parameters<typeof listenReducer>[1]): void {
        this.state = listenReducer(this.state, action)
        this.deps.onStateChange?.(this.state)
    }

    private bumpSession(): void {
        this.clearCountdown()
        this.stopPlayer()
        this.abort?.abort()
        this.abort = new AbortController()
        this.revokeCachedAudio()
        this.inflight.clear()
        this.state = { ...this.state, sessionId: this.state.sessionId + 1 }
    }

    private stopPlayer(): void {
        try {
            this.player?.stop()
        } catch {
            // Player may already be torn down.
        }
        this.player = null
    }

    private revokeCachedAudio(): void {
        const revoke = this.deps.revokeUrl
        if (revoke) {
            for (const url of this.audioCache.values()) {
                try {
                    revoke(url)
                } catch {
                    // Ignore revoke races.
                }
            }
        }
        this.audioCache.clear()
    }

    private buildText(index: number): string {
        const verse = this.state.verses[index]
        const location = this.state.location
        if (!verse || !location) return ''
        return buildListenUtterance({
            verse,
            index,
            bookName: this.context.bookName,
            chapter: location.chapter,
            skipVerseNumbers: this.deps.skipVerseNumbers?.() ?? true,
        })
    }

    private async getAudio(text: string, sessionId: number): Promise<string> {
        const cached = this.audioCache.get(text)
        if (cached) return cached
        const existing = this.inflight.get(text)
        if (existing) return existing

        const signal = this.abort?.signal
        if (!signal || signal.aborted) {
            throw new DOMException('Aborted', 'AbortError')
        }

        const pending = this.deps.fetchAudio(text, signal).then((url) => {
            if (sessionId !== this.state.sessionId) {
                this.deps.revokeUrl?.(url)
                throw new DOMException('Aborted', 'AbortError')
            }
            this.audioCache.set(text, url)
            return url
        })
        this.inflight.set(text, pending)
        try {
            return await pending
        } finally {
            this.inflight.delete(text)
        }
    }

    private prefetchIndex(index: number, sessionId: number): void {
        if (index < 0 || index >= this.state.verses.length) return
        if (sessionId !== this.state.sessionId) return
        const text = this.buildText(index)
        if (!text) return
        void this.getAudio(text, sessionId).catch((err) => {
            if (isAbortError(err)) return
        })
    }

    private async playIndex(index: number, sessionId: number): Promise<void> {
        if (this.disposed || sessionId !== this.state.sessionId) return
        if (!this.state.location || this.state.verses.length === 0) return

        if (index >= this.state.verses.length) {
            this.onChapterComplete(sessionId)
            return
        }

        this.dispatch({ type: 'AUDIO_LOADING', index, sessionId })
        this.prefetchIndex(index + 1, sessionId)

        let url: string
        try {
            url = await this.getAudio(this.buildText(index), sessionId)
        } catch (err) {
            if (sessionId !== this.state.sessionId || isAbortError(err)) return
            this.dispatch({
                type: 'ERROR',
                message: 'Could not load audio. Please try again.',
                sessionId,
            })
            this.deps.onError?.('Could not load audio. Please try again.')
            return
        }

        if (sessionId !== this.state.sessionId) {
            this.deps.revokeUrl?.(url)
            return
        }
        if (this.state.status === 'paused') return

        this.stopPlayer()
        this.dispatch({ type: 'PLAYING', index, sessionId })
        this.player = this.deps.playAudio(url, {
            onEnded: () => {
                if (sessionId !== this.state.sessionId) return
                void this.playIndex(index + 1, sessionId)
            },
            onError: () => {
                if (sessionId !== this.state.sessionId) return
                this.stopPlayer()
                this.dispatch({
                    type: 'ERROR',
                    message: 'Audio playback failed. Tap Listen to try again.',
                    sessionId,
                })
                this.deps.onError?.('Audio playback failed. Tap Listen to try again.')
            },
        })
        const rate = this.deps.speechRate?.()
        if (typeof rate === 'number') this.player.setRate(rate)
    }

    private onChapterComplete(sessionId: number): void {
        if (sessionId !== this.state.sessionId) return
        this.stopPlayer()
        this.dispatch({
            type: 'CHAPTER_COMPLETE',
            countdownSeconds: this.deps.countdownSeconds ?? 3,
            sessionId,
        })
        if (this.state.status !== 'countdown') return
        this.armCountdown(sessionId)
    }

    private armCountdown(sessionId: number): void {
        this.clearCountdown()
        const schedule = this.deps.schedule ?? setTimeout
        const tick = () => {
            if (sessionId !== this.state.sessionId) return
            this.dispatch({ type: 'COUNTDOWN_TICK', sessionId })
            if (this.state.status !== 'countdown') return
            if ((this.state.countdown ?? 0) > 0) {
                this.countdownTimer = schedule(tick, 1000)
                return
            }
            this.finishCountdown(sessionId)
        }
        this.countdownTimer = schedule(tick, 1000)
    }

    private finishCountdown(sessionId: number): void {
        if (sessionId !== this.state.sessionId) return
        const next = this.deps.onAutoAdvance()
        if (!next) {
            this.stop()
            return
        }
        this.requestAutoAdvance(next.location, next.hasNextChapter)
    }

    private clearCountdown(): void {
        if (this.countdownTimer != null) {
            const cancel = this.deps.cancelSchedule ?? clearTimeout
            cancel(this.countdownTimer)
            this.countdownTimer = null
        }
    }
}

export function createBrowserListenPlayer(
    url: string,
    handlers: { onEnded: () => void; onError: (err?: unknown) => void },
    playbackRate: number
): ListenPlayerHandle {
    const audio = new Audio(url)
    audio.playbackRate = playbackRate
    let settled = false
    const onEnded = () => {
        if (settled) return
        settled = true
        handlers.onEnded()
    }
    const onError = (err?: unknown) => {
        if (settled) return
        settled = true
        handlers.onError(err)
    }
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', () => onError())
    void audio.play().catch((err) => onError(err))
    return {
        stop: () => {
            settled = true
            audio.removeEventListener('ended', onEnded)
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
        },
        pause: () => {
            audio.pause()
        },
        resume: () => {
            void audio.play().catch((err) => onError(err))
        },
        setRate: (rate: number) => {
            audio.playbackRate = rate
        },
    }
}
