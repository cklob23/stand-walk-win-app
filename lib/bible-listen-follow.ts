/**
 * Auto-follow the verse being read aloud. Pure so follow / pause / resume
 * can be tested without the DOM. The reader applies the returned commands.
 */

export const LISTEN_FOLLOW_RESUME_MS = 4500
export const LISTEN_FOLLOW_PROGRAMMATIC_SMOOTH_MS = 800
export const LISTEN_FOLLOW_PROGRAMMATIC_INSTANT_MS = 200

export type ListenFollowMode = 'idle' | 'following' | 'user-paused'

export interface ListenFollowState {
    mode: ListenFollowMode
    verse: number | null
    chapterKey: string | null
    lastUserScrollAt: number | null
    programmaticUntil: number
    chapterJustTurned: boolean
}

export const INITIAL_LISTEN_FOLLOW: ListenFollowState = {
    mode: 'idle',
    verse: null,
    chapterKey: null,
    lastUserScrollAt: null,
    programmaticUntil: 0,
    chapterJustTurned: false,
}

export type ListenFollowEvent =
    | { type: 'play'; verse: number; chapterKey: string; now: number }
    | { type: 'verse'; verse: number; chapterKey: string; now: number }
    | { type: 'chapter'; chapterKey: string; now: number }
    | { type: 'user-scroll'; now: number }
    | { type: 'idle-check'; now: number }
    | { type: 'pause' }
    | { type: 'stop' }

export type ListenFollowCommand =
    | { type: 'none' }
    | { type: 'scroll-center'; verse: number }
    | { type: 'scroll-top' }

const SCROLL_KEYS = new Set([
    'ArrowDown',
    'ArrowUp',
    'PageDown',
    'PageUp',
    'Home',
    'End',
    ' ',
    'Spacebar',
])

export function isListenFollowScrollKey(key: string): boolean {
    return SCROLL_KEYS.has(key)
}

export function listenFollowScrollBehavior(reducedMotion: boolean): ScrollBehavior {
    return reducedMotion ? 'auto' : 'smooth'
}

export function programmaticScrollGuardMs(reducedMotion: boolean): number {
    return reducedMotion ? LISTEN_FOLLOW_PROGRAMMATIC_INSTANT_MS : LISTEN_FOLLOW_PROGRAMMATIC_SMOOTH_MS
}

export function shouldIgnoreScrollAsUser(now: number, programmaticUntil: number): boolean {
    return now < programmaticUntil
}

export function markProgrammaticScroll(
    state: ListenFollowState,
    now: number,
    guardMs: number,
): ListenFollowState {
    return { ...state, programmaticUntil: now + guardMs }
}

export function reduceListenFollow(
    state: ListenFollowState,
    event: ListenFollowEvent,
    options: { resumeAfterMs?: number } = {},
): { state: ListenFollowState; command: ListenFollowCommand } {
    const resumeAfterMs = options.resumeAfterMs ?? LISTEN_FOLLOW_RESUME_MS

    switch (event.type) {
        case 'stop':
            return { state: { ...INITIAL_LISTEN_FOLLOW }, command: { type: 'none' } }

        case 'pause':
            return {
                state: { ...state, mode: 'idle', lastUserScrollAt: null, chapterJustTurned: false },
                command: { type: 'none' },
            }

        case 'play':
            return {
                state: {
                    ...state,
                    mode: 'following',
                    verse: event.verse,
                    chapterKey: event.chapterKey,
                    lastUserScrollAt: null,
                    chapterJustTurned: false,
                },
                command: { type: 'scroll-center', verse: event.verse },
            }

        case 'chapter': {
            if (state.mode === 'idle' && !state.chapterKey) {
                return { state: { ...state, chapterKey: event.chapterKey }, command: { type: 'none' } }
            }
            if (state.mode === 'idle') {
                return { state: { ...state, chapterKey: event.chapterKey }, command: { type: 'none' } }
            }
            return {
                state: {
                    ...state,
                    mode: 'following',
                    chapterKey: event.chapterKey,
                    lastUserScrollAt: null,
                    chapterJustTurned: true,
                },
                command: { type: 'scroll-top' },
            }
        }

        case 'verse': {
            const next: ListenFollowState = {
                ...state,
                verse: event.verse,
                chapterKey: event.chapterKey,
            }
            if (state.mode !== 'following') {
                return { state: next, command: { type: 'none' } }
            }
            return {
                state: { ...next, chapterJustTurned: false },
                command: { type: 'scroll-center', verse: event.verse },
            }
        }

        case 'user-scroll':
            if (state.mode === 'idle') {
                return { state, command: { type: 'none' } }
            }
            return {
                state: { ...state, mode: 'user-paused', lastUserScrollAt: event.now, chapterJustTurned: false },
                command: { type: 'none' },
            }

        case 'idle-check': {
            if (state.mode !== 'user-paused' || state.lastUserScrollAt == null) {
                return { state, command: { type: 'none' } }
            }
            if (event.now - state.lastUserScrollAt < resumeAfterMs) {
                return { state, command: { type: 'none' } }
            }
            if (state.verse == null) {
                return { state: { ...state, mode: 'following', lastUserScrollAt: null }, command: { type: 'none' } }
            }
            return {
                state: { ...state, mode: 'following', lastUserScrollAt: null },
                command: { type: 'scroll-center', verse: state.verse },
            }
        }

        default:
            return { state, command: { type: 'none' } }
    }
}
