import { NextRequest, NextResponse } from 'next/server'

// Bolls.life Bible API
const BOLLS_BASE = 'https://bolls.life'

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

// Helper: fetch with timeout and no caching
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'BibleApp/1.0',
            },
        })
        return res
    } finally {
        clearTimeout(timeout)
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const action = searchParams.get('action')
    const translation = (searchParams.get('translation') || 'KJV').toUpperCase()

    try {
        if (action === 'books') {
            const url = `${BOLLS_BASE}/get-books/${translation}/`
            console.log('[v0] Fetching books from:', url)
            const res = await fetchWithTimeout(url)
            console.log('[v0] Books response status:', res.status, res.statusText)
            if (!res.ok) {
                const errBody = await res.text()
                console.log('[v0] Books error body:', errBody.slice(0, 500))
                return NextResponse.json({ error: 'Failed to fetch books', detail: errBody.slice(0, 200) }, { status: res.status })
            }
            const data: { bookid: number; name: string; chapters: number }[] = await res.json()

            // Normalize to our format: { books: [{ id, name, chapters }] }
            const books = data.map((b) => ({
                id: String(b.bookid),
                name: b.name,
                chapters: b.chapters,
            }))

            return NextResponse.json({ books })
        }

        if (action === 'chapters') {
            const bookId = searchParams.get('book')
            if (!bookId) return NextResponse.json({ error: 'Missing book parameter' }, { status: 400 })

            const res = await fetchWithTimeout(`${BOLLS_BASE}/get-books/${translation}/`)
            if (!res.ok) return NextResponse.json({ error: 'Failed to fetch books' }, { status: res.status })
            const booksData: { bookid: number; name: string; chapters: number }[] = await res.json()
            const book = booksData.find((b) => String(b.bookid) === bookId)
            if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

            const chapters = Array.from({ length: book.chapters }, (_, i) => ({ chapter: i + 1 }))
            return NextResponse.json({ chapters })
        }

        if (action === 'verses') {
            const bookId = searchParams.get('book')
            const chapter = searchParams.get('chapter')
            if (!bookId || !chapter) return NextResponse.json({ error: 'Missing book or chapter' }, { status: 400 })

            const versesUrl = `${BOLLS_BASE}/get-text/${translation}/${bookId}/${chapter}/`
            console.log('[v0] Fetching verses from:', versesUrl)
            const res = await fetchWithTimeout(versesUrl)
            console.log('[v0] Verses response status:', res.status, res.statusText)
            if (!res.ok) {
                const errBody = await res.text()
                console.log('[v0] Verses error body:', errBody.slice(0, 500))
                return NextResponse.json({ error: 'Failed to fetch verses', detail: errBody.slice(0, 200) }, { status: res.status })
            }
            const rawText = await res.text()
            console.log('[v0] Verses raw response length:', rawText.length, 'first 200:', rawText.slice(0, 200))

            let data: { pk: number; verse: number; text: string }[]
            try {
                data = JSON.parse(rawText)
            } catch (parseErr) {
                console.log('[v0] JSON parse error:', parseErr instanceof Error ? parseErr.message : String(parseErr))
                return NextResponse.json({ error: 'Invalid JSON from Bible API', detail: rawText.slice(0, 200) }, { status: 502 })
            }

            // Normalize: clean text of HTML, Strong's numbers, cross-references
            const verses = data.map((v) => ({
                book: bookId,
                chapter: Number(chapter),
                verse: v.verse,
                text: cleanVerseText(v.text),
            }))

            return NextResponse.json({ verses })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isTimeout = message.includes('abort') || message.includes('timeout')
        console.log('[v0] Bible API catch error:', message)
        console.log('[v0] Bible API catch stack:', err instanceof Error ? err.stack : 'no stack')
        return NextResponse.json(
            { error: isTimeout ? 'Bible API request timed out' : 'Bible API request failed', detail: message },
            { status: isTimeout ? 504 : 500 }
        )
    }
}
