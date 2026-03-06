'use client'

import { useEffect, useState } from 'react'

interface ScriptureTextProps {
    reference: string
    translation?: string
    className?: string
}

// Maps book names to Bolls.life numeric IDs (same as bible-utils.ts)
const BOOK_MAP: Record<string, string> = {
    'genesis': '1', 'gen': '1',
    'exodus': '2', 'ex': '2',
    'leviticus': '3', 'lev': '3',
    'numbers': '4', 'num': '4',
    'deuteronomy': '5', 'deut': '5',
    'joshua': '6', 'josh': '6',
    'judges': '7', 'judg': '7',
    'ruth': '8',
    '1 samuel': '9', '1 sam': '9',
    '2 samuel': '10', '2 sam': '10',
    '1 kings': '11', '1 ki': '11',
    '2 kings': '12', '2 ki': '12',
    '1 chronicles': '13', '1 chr': '13',
    '2 chronicles': '14', '2 chr': '14',
    'ezra': '15',
    'nehemiah': '16', 'neh': '16',
    'esther': '17', 'est': '17',
    'job': '18',
    'psalms': '19', 'psalm': '19', 'ps': '19',
    'proverbs': '20', 'prov': '20',
    'ecclesiastes': '21', 'eccl': '21',
    'song of solomon': '22', 'song of songs': '22',
    'isaiah': '23', 'isa': '23',
    'jeremiah': '24', 'jer': '24',
    'lamentations': '25', 'lam': '25',
    'ezekiel': '26', 'ezek': '26',
    'daniel': '27', 'dan': '27',
    'hosea': '28', 'hos': '28',
    'joel': '29',
    'amos': '30',
    'obadiah': '31', 'obad': '31',
    'jonah': '32',
    'micah': '33', 'mic': '33',
    'nahum': '34', 'nah': '34',
    'habakkuk': '35', 'hab': '35',
    'zephaniah': '36', 'zeph': '36',
    'haggai': '37', 'hag': '37',
    'zechariah': '38', 'zech': '38',
    'malachi': '39', 'mal': '39',
    'matthew': '40', 'matt': '40',
    'mark': '41',
    'luke': '42',
    'john': '43', 'jn': '43',
    'acts': '44',
    'romans': '45', 'rom': '45',
    '1 corinthians': '46', '1 cor': '46',
    '2 corinthians': '47', '2 cor': '47',
    'galatians': '48', 'gal': '48',
    'ephesians': '49', 'eph': '49',
    'philippians': '50', 'phil': '50',
    'colossians': '51', 'col': '51',
    '1 thessalonians': '52', '1 thess': '52',
    '2 thessalonians': '53', '2 thess': '53',
    '1 timothy': '54', '1 tim': '54',
    '2 timothy': '55', '2 tim': '55',
    'titus': '56',
    'philemon': '57', 'phlm': '57',
    'hebrews': '58', 'heb': '58',
    'james': '59', 'jas': '59',
    '1 peter': '60', '1 pet': '60',
    '2 peter': '61', '2 pet': '61',
    '1 john': '62',
    '2 john': '63',
    '3 john': '64',
    'jude': '65',
    'revelation': '66', 'rev': '66',
}

function parseReference(ref: string): { bookId: string; chapter: number; startVerse?: number; endVerse?: number; cleanRef: string } | null {
    // Strip any embedded text after " - " (e.g. 'John 3:3-7 - "Jesus answered..."')
    const cleanRef = ref.split(/\s*-\s*\u201C|\s*-\s*"/)[0].trim()
    const match = cleanRef.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/)
    if (!match) return null
    const bookName = match[1].trim().toLowerCase()
    const chapter = parseInt(match[2], 10)
    const bookId = BOOK_MAP[bookName]
    if (!bookId) return null
    return {
        bookId,
        chapter,
        startVerse: match[3] ? parseInt(match[3], 10) : undefined,
        endVerse: match[4] ? parseInt(match[4], 10) : undefined,
        cleanRef,
    }
}

/**
 * Fetches and displays the actual text of a Bible verse/passage
 * in the user's preferred translation.
 */
export function ScriptureText({ reference, translation = 'NIV', className = '' }: ScriptureTextProps) {
    const [text, setText] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const parsed = parseReference(reference)

    useEffect(() => {
        if (!parsed) {
            setLoading(false)
            return
        }

        setLoading(true)
        fetch(`/api/bible?action=verses&translation=${translation}&book=${parsed.bookId}&chapter=${parsed.chapter}`)
            .then(r => r.json())
            .then(data => {
                if (data.verses && data.verses.length > 0) {
                    let filtered = data.verses
                    if (parsed.startVerse) {
                        const end = parsed.endVerse || parsed.startVerse
                        filtered = data.verses.filter(
                            (v: { verse: number }) => v.verse >= parsed.startVerse! && v.verse <= end
                        )
                    }
                    const verseText = filtered
                        .map((v: { text: string }) => v.text.replace(/\n/g, ' ').trim())
                        .join(' ')
                    setText(verseText || null)
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reference, translation])

    const displayRef = parsed?.cleanRef || reference

    if (loading) {
        return <span className={`animate-pulse text-muted-foreground ${className}`}>Loading scripture...</span>
    }

    if (!text) {
        return <span className={className}>{displayRef}</span>
    }

    return (
        <span className={className}>
            {displayRef} - {'\u201C'}{text}{'\u201D'}
        </span>
    )
}
