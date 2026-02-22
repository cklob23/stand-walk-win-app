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

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const action = searchParams.get('action')
    const translation = (searchParams.get('translation') || 'KJV').toUpperCase()

    try {
        if (action === 'books') {
            const res = await fetch(`${BOLLS_BASE}/get-books/${translation}/`, { next: { revalidate: 86400 } })
            if (!res.ok) return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
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

            // We already have the chapter count from the books list,
            // but we need to return the same format the frontend expects.
            // Fetch the books list to get chapter count for this book.
            const res = await fetch(`${BOLLS_BASE}/get-books/${translation}/`, { next: { revalidate: 86400 } })
            if (!res.ok) return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
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

            const res = await fetch(
                `${BOLLS_BASE}/get-text/${translation}/${bookId}/${chapter}/`,
                { next: { revalidate: 86400 } }
            )
            if (!res.ok) return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 500 })
            const data: { pk: number; verse: number; text: string }[] = await res.json()

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
    } catch {
        return NextResponse.json({ error: 'Bible API request failed' }, { status: 500 })
    }
}
