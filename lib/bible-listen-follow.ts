/**
 * Auto-follow the verse being read aloud. Pure so follow / pause / resume
 * can be tested without the DOM. The reader applies the returned commands.
 */

export const LISTEN_FOLLOW_RESUME_MS = 4500
export const LISTEN_FOLLOW_PROGRAMMATIC_SMOOTH_MS = 800
export const LISTEN_FOLLOW_PROGRAMMATIC_INSTANT_MS = 200
export const LISTEN_FOLLOW_PROGRAMMATIC_MAX_MS = 2500
export const LISTEN_FOLLOW_HEADER_PX = 64
export const LISTEN_FOLLOW_TARGET_TOLERANCE_PX = 2

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

export type ListenFollowScrollIntent = 'wheel' | 'touch' | 'key' | 'scroll'

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

const INTERACTIVE_KEY_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'])

export function isListenFollowScrollKey(key: string): boolean {
    return SCROLL_KEYS.has(key)
}

export function isListenFollowInteractiveKeyTarget(
    tagName: string,
    role?: string | null,
): boolean {
    const tag = tagName.toUpperCase()
    if (INTERACTIVE_KEY_TAGS.has(tag)) return true
    if (role === 'button' || role === 'link') return true
    return false
}

export function isListenFollowInteractiveEventTarget(target: EventTarget | null): boolean {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return false
    return target.closest(
        'button, a, input, textarea, select, [role="button"], [role="link"], [contenteditable="true"]',
    ) != null
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

/**
 * Time-guard applies only to `scroll` events. Wheel, touch, and key input
 * are always treated as the user, even right after an auto-scroll.
 */
export function shouldIgnoreUserScrollIntent(
    source: ListenFollowScrollIntent,
    now: number,
    programmaticUntil: number,
    options: { currentTop?: number; targetTop?: number | null } = {},
): boolean {
    if (source !== 'scroll') return false
    return shouldIgnoreScrollEventAsUser({
        now,
        programmaticUntil,
        currentTop: options.currentTop ?? 0,
        targetTop: options.targetTop ?? null,
    })
}

export function isListenFollowStillApproachingTarget(
    currentTop: number,
    targetTop: number,
    tolerancePx: number = LISTEN_FOLLOW_TARGET_TOLERANCE_PX,
): boolean {
    return Math.abs(currentTop - targetTop) > tolerancePx
}

export function shouldIgnoreScrollEventAsUser(input: {
    now: number
    programmaticUntil: number
    currentTop: number
    targetTop: number | null
}): boolean {
    if (input.targetTop != null) {
        // Commanded scroll still owns this container until scrollend (or a
        // timeout) clears the target — even if the short time guard expired
        // mid-animation (long scroll-to-top).
        return true
    }
    return shouldIgnoreScrollAsUser(input.now, input.programmaticUntil)
}

export function markProgrammaticScroll(
    state: ListenFollowState,
    now: number,
    guardMs: number,
): ListenFollowState {
    return { ...state, programmaticUntil: now + guardMs }
}

export function clearProgrammaticScroll(state: ListenFollowState): ListenFollowState {
    return { ...state, programmaticUntil: 0 }
}

/** Remaining ms until glide-back. Null if there is no user-scroll timestamp. */
export function listenFollowResumeDelayMs(
    lastUserScrollAt: number | null,
    now: number,
    resumeAfterMs: number = LISTEN_FOLLOW_RESUME_MS,
): number | null {
    if (lastUserScrollAt == null) return null
    return Math.max(0, resumeAfterMs - (now - lastUserScrollAt))
}

export function listenFollowWindowMetrics(
    innerHeight: number,
    headerPx: number = LISTEN_FOLLOW_HEADER_PX,
): { viewportTop: number; viewportHeight: number } {
    return {
        viewportTop: headerPx,
        viewportHeight: Math.max(0, innerHeight - headerPx),
    }
}

export function listenFollowCenterScrollTop(input: {
    currentScrollTop: number
    elementTopInViewport: number
    elementHeight: number
    viewportTop: number
    viewportHeight: number
}): number {
    const elCenter = input.elementTopInViewport + input.elementHeight / 2
    const visibleCenter = input.viewportTop + input.viewportHeight / 2
    return input.currentScrollTop + (elCenter - visibleCenter)
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

export function isListenFollowElementVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
}

export function findVisibleVerseElement(root: ParentNode | null, verse: number): HTMLElement | null {
    if (typeof document === 'undefined') return null
    const selector = `#verse-${verse}`
    const scoped = root?.querySelector<HTMLElement>(selector) ?? null
    if (scoped && isListenFollowElementVisible(scoped)) return scoped
    const all = document.querySelectorAll<HTMLElement>(selector)
    for (const el of all) {
        if (isListenFollowElementVisible(el)) return el
    }
    return scoped ?? all[0] ?? null
}

export function findListenFollowScrollContainer(start: Element | null): Window | HTMLElement {
    if (typeof document === 'undefined' || typeof window === 'undefined') return window
    let node: HTMLElement | null = start instanceof HTMLElement ? start : start?.parentElement ?? null
    while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node)
        const overflowY = style.overflowY
        if (
            (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
            node.scrollHeight > node.clientHeight + 1
        ) {
            return node
        }
        node = node.parentElement
    }
    return window
}

function isElementScrollContainer(container: Window | HTMLElement): container is HTMLElement {
    return typeof HTMLElement !== 'undefined' && container instanceof HTMLElement
}

export function getListenFollowScrollTop(container: Window | HTMLElement): number {
    return isElementScrollContainer(container) ? container.scrollTop : window.scrollY
}

export function scrollListenFollowContainer(
    container: Window | HTMLElement,
    top: number,
    behavior: ScrollBehavior,
): void {
    const clamped = Math.max(0, top)
    if (isElementScrollContainer(container)) {
        container.scrollTo({ top: clamped, left: 0, behavior })
        return
    }
    window.scrollTo({ top: clamped, left: 0, behavior })
}

export function listenFollowTargetTopForElement(
    el: HTMLElement,
    container: Window | HTMLElement,
): number {
    const elRect = el.getBoundingClientRect()
    if (isElementScrollContainer(container)) {
        const cRect = container.getBoundingClientRect()
        return listenFollowCenterScrollTop({
            currentScrollTop: container.scrollTop,
            elementTopInViewport: elRect.top,
            elementHeight: elRect.height,
            viewportTop: cRect.top,
            viewportHeight: container.clientHeight,
        })
    }
    const { viewportTop, viewportHeight } = listenFollowWindowMetrics(window.innerHeight)
    return listenFollowCenterScrollTop({
        currentScrollTop: window.scrollY,
        elementTopInViewport: elRect.top,
        elementHeight: elRect.height,
        viewportTop,
        viewportHeight,
    })
}

export function listenFollowScrollTopFromEvent(event: Event): {
    container: Window | HTMLElement
    top: number
} {
    const target = event.target
    if (
        target === document ||
        target === document.documentElement ||
        target === document.body
    ) {
        return { container: window, top: window.scrollY }
    }
    if (target instanceof HTMLElement) {
        return { container: target, top: target.scrollTop }
    }
    return { container: window, top: window.scrollY }
}
