import { NextRequest, NextResponse } from 'next/server'
import { BOOK_ID_TO_NAME, resolveBibleTranslation } from '@/lib/bible-utils'

// Bolls.life Bible API (primary path for supported translations)
const BOLLS_BASE = 'https://bolls.life'
const BIBLE_API_BASE = 'https://bible-api.com'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const FETCH_REVALIDATE_SECONDS = 86400

type CacheEntry = { expiresAt: number; value: unknown }

const responseCache = new Map<string, CacheEntry>()

function cacheGet<T>(key: string): T | undefined {
    const entry = responseCache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
        responseCache.delete(key)
        return undefined
    }
    // LRU: refresh insertion order
    responseCache.delete(key)
    responseCache.set(key, entry)
    return entry.value as T
}

function cacheSet(key: string, value: unknown) {
    if (responseCache.has(key)) responseCache.delete(key)
    responseCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
    while (responseCache.size > CACHE_MAX_ENTRIES) {
        const oldest = responseCache.keys().next().value
        if (oldest === undefined) break
        responseCache.delete(oldest)
    }
}

function cacheKey(parts: Array<string | null | undefined>): string {
    return parts.map((p) => (p ?? '')).join(':')
}

type NormalizedVerse = {
    book: string
    chapter: number
    verse: number
    text: string
}

type VersePayload = {
    verses: NormalizedVerse[]
    fallbackTranslation?: string
}

const COMPLAINT_RE = /biblica|copyright|license|removed|not available/i

function looksLikeComplaint(verses: NormalizedVerse[]): boolean {
    if (verses.length === 0) return true

    const hasVerseNumbers = verses.some(
        (v) => typeof v.verse === 'number' && Number.isFinite(v.verse) && v.verse >= 1
    )
    if (!hasVerseNumbers) return true

    const texts = verses.map((v) => v.text.trim()).filter(Boolean)
    if (texts.length === 0) return true
    if (texts.some((t) => COMPLAINT_RE.test(t))) return true
    if (texts.length >= 2 && texts.every((t) => t === texts[0])) return true

    return false
}

// Clean verse text: strip HTML, Strong's numbers, cross-reference markers, etc.
function cleanVerseText(html: string): string {
    let text = html
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#?\w+;/g, '')
        // Remove Strong's concordance numbers (e.g., "word1234" -> "word")
        // These appear as digits immediately after a word with no space
        .replace(/([a-zA-Z])(\d{2,5})\b/g, '$1')
        // Remove standalone Strong's numbers (just digits with no preceding letter)
        .replace(/\b\d{3,5}\b/g, '')
        // Remove cross-reference markers: circled letters/numbers (Unicode)
        .replace(/[\u24B6-\u24FF\u2460-\u2473\u3251-\u325F\u32B1-\u32BF]/g, '')
        // Remove bracketed cross-references like [1], [2], [a], etc.
        .replace(/\[\d+\]/g, '')
        .replace(/\[[a-zA-Z]\]/g, '')
        // Remove paragraph markers like ¶
        .replace(/¶/g, '')
        // Collapse multiple spaces into one
        .replace(/\s{2,}/g, ' ')
        .trim()

    return text
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            next: { revalidate: FETCH_REVALIDATE_SECONDS },
            headers: {
                Accept: 'application/json',
                'User-Agent': 'BibleApp/1.0',
            },
        })
        return res
    } finally {
        clearTimeout(timeout)
    }
}

async function readJsonArray<T>(res: Response): Promise<T[] | null> {
    const rawText = await res.text()
    try {
        const data = JSON.parse(rawText)
        return Array.isArray(data) ? data : null
    } catch {
        return null
    }
}

async function fetchBollsBooks(translation: string): Promise<{ id: string; name: string; chapters: number }[] | null> {
    try {
        const res = await fetchWithTimeout(`${BOLLS_BASE}/get-books/${translation}/`)
        if (!res.ok) return null
        const data = await readJsonArray<{ bookid: number; name: string; chapters: number }>(res)
        if (!data) return null
        return data.map((b) => ({
            id: String(b.bookid),
            name: b.name,
            chapters: b.chapters,
        }))
    } catch {
        return null
    }
}

async function fetchBollsVerses(
    translation: string,
    bookId: string,
    chapter: string
): Promise<NormalizedVerse[] | null> {
    try {
        const res = await fetchWithTimeout(`${BOLLS_BASE}/get-text/${translation}/${bookId}/${chapter}/`)
        if (!res.ok) return null
        const data = await readJsonArray<{ pk?: number; verse: number; text: string }>(res)
        if (!data) return null
        const verses = data.map((v) => ({
            book: bookId,
            chapter: Number(chapter),
            verse: v.verse,
            text: cleanVerseText(v.text || ''),
        }))
        if (looksLikeComplaint(verses)) return null
        return verses
    } catch {
        return null
    }
}

async function fetchBibleApiVerses(
    translation: 'kjv' | 'asv',
    bookId: string,
    chapter: string
): Promise<NormalizedVerse[] | null> {
    const bookName = BOOK_ID_TO_NAME[bookId]
    if (!bookName) return null
    const slug = bookName.replace(/\s+/g, '+')
    const url = `${BIBLE_API_BASE}/${slug}+${chapter}?translation=${translation}&single_chapter_book_matching=indifferent`
    try {
        const res = await fetchWithTimeout(url)
        if (!res.ok) return null
        const rawText = await res.text()
        let data: { verses?: { verse: number; text: string }[] }
        try {
            data = JSON.parse(rawText)
        } catch {
            return null
        }
        if (!Array.isArray(data.verses) || data.verses.length === 0) return null
        const verses = data.verses.map((v) => ({
            book: bookId,
            chapter: Number(chapter),
            verse: v.verse,
            text: cleanVerseText(v.text || ''),
        }))
        if (looksLikeComplaint(verses)) return null
        return verses
    } catch {
        return null
    }
}

async function fetchVersesWithFallback(
    requested: string,
    bookId: string,
    chapter: string
): Promise<VersePayload | null> {
    const primary = await fetchBollsVerses(requested, bookId, chapter)
    if (primary) return { verses: primary }

    const fallbacks: Array<{ code: string; source: 'bible-api' | 'bolls' }> = [
        { code: 'KJV', source: 'bible-api' },
        { code: 'ASV', source: 'bible-api' },
        { code: 'KJV', source: 'bolls' },
        { code: 'ASV', source: 'bolls' },
    ]

    for (const fb of fallbacks) {
        if (fb.source === 'bolls' && fb.code === requested) continue
        const verses =
            fb.source === 'bible-api'
                ? await fetchBibleApiVerses(fb.code.toLowerCase() as 'kjv' | 'asv', bookId, chapter)
                : await fetchBollsVerses(fb.code, bookId, chapter)
        if (verses) {
            return {
                verses,
                fallbackTranslation: fb.code !== requested ? fb.code : undefined,
            }
        }
    }

    return null
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const action = searchParams.get('action')
    const translation = resolveBibleTranslation(searchParams.get('translation'))

    try {
        if (action === 'books') {
            const key = cacheKey(['books', translation])
            const cached = cacheGet<{ books: { id: string; name: string; chapters: number }[] }>(key)
            if (cached) return NextResponse.json(cached)

            const books = await fetchBollsBooks(translation)
            if (!books) {
                return NextResponse.json({ error: 'Failed to fetch books' }, { status: 502 })
            }
            const payload = { books }
            cacheSet(key, payload)
            return NextResponse.json(payload)
        }

        if (action === 'chapters') {
            const bookId = searchParams.get('book')
            if (!bookId) return NextResponse.json({ error: 'Missing book parameter' }, { status: 400 })

            const key = cacheKey(['chapters', translation, bookId])
            const cached = cacheGet<{ chapters: { chapter: number }[] }>(key)
            if (cached) return NextResponse.json(cached)

            const books = await fetchBollsBooks(translation)
            if (!books) return NextResponse.json({ error: 'Failed to fetch books' }, { status: 502 })
            const book = books.find((b) => b.id === bookId)
            if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

            const payload = {
                chapters: Array.from({ length: book.chapters }, (_, i) => ({ chapter: i + 1 })),
            }
            cacheSet(key, payload)
            return NextResponse.json(payload)
        }

        if (action === 'verses') {
            const bookId = searchParams.get('book')
            const chapter = searchParams.get('chapter')
            if (!bookId || !chapter) {
                return NextResponse.json({ error: 'Missing book or chapter' }, { status: 400 })
            }

            const key = cacheKey(['verses', translation, bookId, chapter])
            const cached = cacheGet<VersePayload>(key)
            if (cached) return NextResponse.json(cached)

            const payload = await fetchVersesWithFallback(translation, bookId, chapter)
            if (!payload) {
                return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 502 })
            }
            cacheSet(key, payload)
            return NextResponse.json(payload)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isTimeout = message.includes('abort') || message.includes('timeout')
        return NextResponse.json(
            { error: isTimeout ? 'Bible API request timed out' : 'Bible API request failed', detail: message },
            { status: isTimeout ? 504 : 500 }
        )
    }
}
