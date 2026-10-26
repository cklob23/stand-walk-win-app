import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    INITIAL_LISTEN_FOLLOW,
    LISTEN_FOLLOW_HEADER_PX,
    LISTEN_FOLLOW_RESUME_MS,
    isListenFollowInteractiveKeyTarget,
    isListenFollowScrollKey,
    isListenFollowStillApproachingTarget,
    listenFollowCenterScrollTop,
    listenFollowResumeDelayMs,
    listenFollowScrollBehavior,
    listenFollowWindowMetrics,
    markProgrammaticScroll,
    reduceListenFollow,
    shouldIgnoreScrollAsUser,
    shouldIgnoreUserScrollIntent,
} from './bible-listen-follow.ts'

const CHAPTER = '43:3'

function reduce(
    state: typeof INITIAL_LISTEN_FOLLOW,
    event: Parameters<typeof reduceListenFollow>[1],
) {
    return reduceListenFollow(state, event)
}

describe('bible listen auto-follow', () => {
    it('centers the current verse when audio starts', () => {
        const { state, command } = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 4,
            chapterKey: CHAPTER,
            now: 1000,
        })
        assert.equal(state.mode, 'following')
        assert.deepEqual(command, { type: 'scroll-center', verse: 4 })
    })

    it('keeps following as the verse advances', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 1,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const { command } = reduce(playing, { type: 'verse', verse: 2, chapterKey: CHAPTER, now: 2000 })
        assert.deepEqual(command, { type: 'scroll-center', verse: 2 })
    })

    it('does not jump on a chapter key while idle', () => {
        const { state, command } = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'chapter',
            chapterKey: CHAPTER,
            now: 0,
        })
        assert.equal(state.mode, 'idle')
        assert.equal(state.chapterKey, CHAPTER)
        assert.equal(command.type, 'none')
    })

    it('recenters when play resumes after an audio pause', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 5,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const paused = reduce(playing, { type: 'pause' }).state
        const resumed = reduce(paused, {
            type: 'play',
            verse: 5,
            chapterKey: CHAPTER,
            now: 900,
        })
        assert.equal(resumed.state.mode, 'following')
        assert.deepEqual(resumed.command, { type: 'scroll-center', verse: 5 })
    })

    it('does not scroll when audio is paused or stopped', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 5,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const paused = reduce(playing, { type: 'pause' })
        assert.equal(paused.state.mode, 'idle')
        assert.equal(paused.command.type, 'none')
        const afterVerse = reduce(paused.state, {
            type: 'verse',
            verse: 6,
            chapterKey: CHAPTER,
            now: 100,
        })
        assert.equal(afterVerse.command.type, 'none')
        const stopped = reduce(playing, { type: 'stop' })
        assert.equal(stopped.state.mode, 'idle')
        assert.equal(stopped.command.type, 'none')
    })

    it('pauses follow on user scroll and does not fight the next verse', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 1,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const scrolled = reduce(playing, { type: 'user-scroll', now: 500 })
        assert.equal(scrolled.state.mode, 'user-paused')
        assert.equal(scrolled.command.type, 'none')
        const nextVerse = reduce(scrolled.state, {
            type: 'verse',
            verse: 2,
            chapterKey: CHAPTER,
            now: 800,
        })
        assert.equal(nextVerse.state.mode, 'user-paused')
        assert.equal(nextVerse.command.type, 'none')
    })

    it('resumes after 4.5s idle and ignores an early idle check', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 3,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const scrolled = reduce(playing, { type: 'user-scroll', now: 1000 }).state
        const early = reduce(scrolled, { type: 'idle-check', now: 1000 + LISTEN_FOLLOW_RESUME_MS - 1 })
        assert.equal(early.command.type, 'none')
        assert.equal(early.state.mode, 'user-paused')
        const later = reduce(scrolled, { type: 'idle-check', now: 1000 + LISTEN_FOLLOW_RESUME_MS })
        assert.equal(later.state.mode, 'following')
        assert.deepEqual(later.command, { type: 'scroll-center', verse: 3 })
    })

    it('resets the idle timer if the user keeps scrolling', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 1,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const first = reduce(playing, { type: 'user-scroll', now: 1000 }).state
        const second = reduce(first, { type: 'user-scroll', now: 4000 }).state
        const tooSoon = reduce(second, { type: 'idle-check', now: 4000 + 2000 })
        assert.equal(tooSoon.command.type, 'none')
        const ready = reduce(second, { type: 'idle-check', now: 4000 + LISTEN_FOLLOW_RESUME_MS })
        assert.deepEqual(ready.command, { type: 'scroll-center', verse: 1 })
    })

    it('returns to the top on a chapter turn even if the user had scrolled away', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 25,
            chapterKey: '43:3',
            now: 0,
        }).state
        const scrolled = reduce(playing, { type: 'user-scroll', now: 400 }).state
        const turned = reduce(scrolled, { type: 'chapter', chapterKey: '43:4', now: 500 })
        assert.equal(turned.state.mode, 'following')
        assert.equal(turned.state.lastUserScrollAt, null)
        assert.deepEqual(turned.command, { type: 'scroll-top' })
    })

    it('starts at the top on a chapter turn, then centers the verse being read', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 25,
            chapterKey: '43:3',
            now: 0,
        }).state
        const turned = reduce(playing, { type: 'chapter', chapterKey: '43:4', now: 50 })
        assert.equal(turned.state.mode, 'following')
        assert.equal(turned.state.chapterJustTurned, true)
        assert.deepEqual(turned.command, { type: 'scroll-top' })
        const firstVerse = reduce(turned.state, {
            type: 'verse',
            verse: 1,
            chapterKey: '43:4',
            now: 200,
        })
        assert.equal(firstVerse.state.chapterJustTurned, false)
        assert.deepEqual(firstVerse.command, { type: 'scroll-center', verse: 1 })
    })

    it('keeps the original glide-back clock when verses advance during a user pause', () => {
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 1,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const scrolled = reduce(playing, { type: 'user-scroll', now: 1000 }).state
        assert.equal(scrolled.lastUserScrollAt, 1000)

        let paused = scrolled
        for (const [verse, at] of [[2, 4000], [3, 7000], [4, 10000]] as const) {
            const next = reduce(paused, { type: 'verse', verse, chapterKey: CHAPTER, now: at })
            assert.equal(next.state.mode, 'user-paused')
            assert.equal(next.state.lastUserScrollAt, 1000)
            assert.equal(next.state.verse, verse)
            assert.equal(next.command.type, 'none')
            paused = next.state
        }

        const tooSoon = reduce(paused, {
            type: 'idle-check',
            now: 1000 + LISTEN_FOLLOW_RESUME_MS - 1,
        })
        assert.equal(tooSoon.state.mode, 'user-paused')
        assert.equal(tooSoon.command.type, 'none')

        const ready = reduce(paused, {
            type: 'idle-check',
            now: 1000 + LISTEN_FOLLOW_RESUME_MS,
        })
        assert.equal(ready.state.mode, 'following')
        assert.deepEqual(ready.command, { type: 'scroll-center', verse: 4 })
        assert.equal(listenFollowResumeDelayMs(1000, 4000), 1500)
        assert.equal(listenFollowResumeDelayMs(1000, 1000 + LISTEN_FOLLOW_RESUME_MS), 0)
        assert.equal(listenFollowResumeDelayMs(null, 4000), null)
    })

    it('does not treat a programmatic scroll as a user scroll', () => {
        const marked = markProgrammaticScroll(INITIAL_LISTEN_FOLLOW, 1000, 800)
        assert.equal(shouldIgnoreScrollAsUser(1000, marked.programmaticUntil), true)
        assert.equal(shouldIgnoreScrollAsUser(1799, marked.programmaticUntil), true)
        assert.equal(shouldIgnoreScrollAsUser(1800, marked.programmaticUntil), false)
        const playing = reduce(INITIAL_LISTEN_FOLLOW, {
            type: 'play',
            verse: 1,
            chapterKey: CHAPTER,
            now: 0,
        }).state
        const ignored = reduce(playing, { type: 'user-scroll', now: 10 })
        // The reducer itself always records user-scroll; the reader must
        // filter programmatic events before dispatching.
        assert.equal(ignored.state.mode, 'user-paused')
        assert.equal(isListenFollowScrollKey('ArrowDown'), true)
        assert.equal(isListenFollowScrollKey('PageDown'), true)
        assert.equal(isListenFollowScrollKey('a'), false)
        assert.equal(listenFollowScrollBehavior(true), 'auto')
        assert.equal(listenFollowScrollBehavior(false), 'smooth')
        assert.equal(isListenFollowScrollKey(' '), true)
        assert.equal(isListenFollowScrollKey('Enter'), false)
        assert.equal(isListenFollowInteractiveKeyTarget('BUTTON'), true)
        assert.equal(isListenFollowInteractiveKeyTarget('A'), true)
        assert.equal(isListenFollowInteractiveKeyTarget('INPUT'), true)
        assert.equal(isListenFollowInteractiveKeyTarget('DIV', 'button'), true)
        assert.equal(isListenFollowInteractiveKeyTarget('DIV'), false)
        assert.equal(shouldIgnoreUserScrollIntent('wheel', 1000, 1800), false)
        assert.equal(shouldIgnoreUserScrollIntent('touch', 1000, 1800), false)
        assert.equal(shouldIgnoreUserScrollIntent('key', 1000, 1800), false)
        assert.equal(shouldIgnoreUserScrollIntent('scroll', 1000, 1800), true)
        assert.equal(
            shouldIgnoreUserScrollIntent('scroll', 2000, 1800, { currentTop: 420, targetTop: 0 }),
            true,
        )
        assert.equal(shouldIgnoreUserScrollIntent('scroll', 2000, 1800, { targetTop: null }), false)
        assert.equal(isListenFollowStillApproachingTarget(420, 0), true)
        assert.equal(isListenFollowStillApproachingTarget(1, 0), false)

        const windowMetrics = listenFollowWindowMetrics(800)
        assert.equal(windowMetrics.viewportTop, LISTEN_FOLLOW_HEADER_PX)
        assert.equal(windowMetrics.viewportHeight, 736)
        const centered = listenFollowCenterScrollTop({
            currentScrollTop: 0,
            elementTopInViewport: 500,
            elementHeight: 20,
            viewportTop: windowMetrics.viewportTop,
            viewportHeight: windowMetrics.viewportHeight,
        })
        const fullViewportCenter = listenFollowCenterScrollTop({
            currentScrollTop: 0,
            elementTopInViewport: 500,
            elementHeight: 20,
            viewportTop: 0,
            viewportHeight: 800,
        })
        assert.equal(centered, 78)
        assert.equal(fullViewportCenter, 110)
        assert.equal(fullViewportCenter - centered, 32)
    })
})
