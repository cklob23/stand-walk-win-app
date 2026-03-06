// Maps common Bible book names to Bolls.life numeric book IDs
// Standard Protestant canon: Genesis=1 ... Revelation=66
export const BOOK_MAP: Record<string, string> = {
    'genesis': '1', 'gen': '1',
    'exodus': '2', 'exo': '2', 'ex': '2',
    'leviticus': '3', 'lev': '3',
    'numbers': '4', 'num': '4',
    'deuteronomy': '5', 'deut': '5', 'deu': '5',
    'joshua': '6', 'josh': '6', 'jos': '6',
    'judges': '7', 'judg': '7', 'jdg': '7',
    'ruth': '8', 'rut': '8',
    '1 samuel': '9', '1 sam': '9', '1samuel': '9',
    '2 samuel': '10', '2 sam': '10', '2samuel': '10',
    '1 kings': '11', '1 ki': '11', '1kings': '11',
    '2 kings': '12', '2 ki': '12', '2kings': '12',
    '1 chronicles': '13', '1 chr': '13', '1chronicles': '13',
    '2 chronicles': '14', '2 chr': '14', '2chronicles': '14',
    'ezra': '15', 'ezr': '15',
    'nehemiah': '16', 'neh': '16',
    'esther': '17', 'est': '17',
    'job': '18',
    'psalms': '19', 'psalm': '19', 'ps': '19', 'psa': '19',
    'proverbs': '20', 'prov': '20', 'pro': '20',
    'ecclesiastes': '21', 'eccl': '21', 'ecc': '21',
    'song of solomon': '22', 'song of songs': '22', 'song': '22', 'sos': '22',
    'isaiah': '23', 'isa': '23',
    'jeremiah': '24', 'jer': '24',
    'lamentations': '25', 'lam': '25',
    'ezekiel': '26', 'ezek': '26', 'ezk': '26',
    'daniel': '27', 'dan': '27',
    'hosea': '28', 'hos': '28',
    'joel': '29', 'jol': '29',
    'amos': '30', 'amo': '30',
    'obadiah': '31', 'obad': '31', 'oba': '31',
    'jonah': '32', 'jon': '32',
    'micah': '33', 'mic': '33',
    'nahum': '34', 'nah': '34', 'nam': '34',
    'habakkuk': '35', 'hab': '35',
    'zephaniah': '36', 'zeph': '36', 'zep': '36',
    'haggai': '37', 'hag': '37',
    'zechariah': '38', 'zech': '38', 'zec': '38',
    'malachi': '39', 'mal': '39',
    'matthew': '40', 'matt': '40', 'mat': '40',
    'mark': '41', 'mrk': '41',
    'luke': '42', 'luk': '42',
    'john': '43', 'jhn': '43', 'jn': '43',
    'acts': '44', 'act': '44',
    'romans': '45', 'rom': '45',
    '1 corinthians': '46', '1 cor': '46', '1corinthians': '46',
    '2 corinthians': '47', '2 cor': '47', '2corinthians': '47',
    'galatians': '48', 'gal': '48',
    'ephesians': '49', 'eph': '49',
    'philippians': '50', 'phil': '50', 'php': '50',
    'colossians': '51', 'col': '51',
    '1 thessalonians': '52', '1 thess': '52', '1thessalonians': '52',
    '2 thessalonians': '53', '2 thess': '53', '2thessalonians': '53',
    '1 timothy': '54', '1 tim': '54', '1timothy': '54',
    '2 timothy': '55', '2 tim': '55', '2timothy': '55',
    'titus': '56', 'tit': '56',
    'philemon': '57', 'phlm': '57', 'phm': '57',
    'hebrews': '58', 'heb': '58',
    'james': '59', 'jas': '59',
    '1 peter': '60', '1 pet': '60', '1peter': '60',
    '2 peter': '61', '2 pet': '61', '2peter': '61',
    '1 john': '62', '1john': '62',
    '2 john': '63', '2john': '63',
    '3 john': '64', '3john': '64',
    'jude': '65', 'jud': '65',
    'revelation': '66', 'rev': '66',
}

/**
 * Extract all scripture references from a block of text.
 * Matches patterns like "John 3:1-21", "Matthew 28:19-20", "Romans 6:3-4",
 * "Psalm 23", "1 Corinthians 13", etc.
 * Returns an array of { reference, url } objects.
 */
export function extractScriptureReferences(text: string): { reference: string; url: string }[] {
    if (!text) return []

    // Only use full book names (4+ chars) and numbered book names to avoid false positives
    // from short abbreviations like "ex", "am", "act" matching random words
    const bookNames = Object.keys(BOOK_MAP)
        .filter(n => n.length >= 4 || /^\d/.test(n))
        .sort((a, b) => b.length - a.length)
    const bookPattern = bookNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

    // Match: (word boundary)BookName Chapter:VerseStart(-VerseEnd)?
    // Requires a chapter number after the book name
    const regex = new RegExp(
        `\\b(?:${bookPattern})\\s+\\d+(?::\\d+(?:\\s*-\\s*\\d+)?)?`,
        'gi'
    )

    const matches = text.match(regex)
    if (!matches) return []

    // Deduplicate and convert to URLs
    const seen = new Set<string>()
    const results: { reference: string; url: string }[] = []
    for (const match of matches) {
        const trimmed = match.trim()
        const normalized = trimmed.toLowerCase()
        if (seen.has(normalized)) continue
        seen.add(normalized)
        const url = scriptureToUrl(trimmed)
        if (url) {
            results.push({ reference: trimmed, url })
        }
    }
    return results
}

// Reverse lookup: book ID -> display name (exported for consistent book name display)
export const BOOK_ID_TO_NAME: Record<string, string> = {
    '1': 'Genesis', '2': 'Exodus', '3': 'Leviticus', '4': 'Numbers', '5': 'Deuteronomy',
    '6': 'Joshua', '7': 'Judges', '8': 'Ruth', '9': '1 Samuel', '10': '2 Samuel',
    '11': '1 Kings', '12': '2 Kings', '13': '1 Chronicles', '14': '2 Chronicles',
    '15': 'Ezra', '16': 'Nehemiah', '17': 'Esther', '18': 'Job', '19': 'Psalms',
    '20': 'Proverbs', '21': 'Ecclesiastes', '22': 'Song of Solomon', '23': 'Isaiah',
    '24': 'Jeremiah', '25': 'Lamentations', '26': 'Ezekiel', '27': 'Daniel',
    '28': 'Hosea', '29': 'Joel', '30': 'Amos', '31': 'Obadiah', '32': 'Jonah',
    '33': 'Micah', '34': 'Nahum', '35': 'Habakkuk', '36': 'Zephaniah', '37': 'Haggai',
    '38': 'Zechariah', '39': 'Malachi', '40': 'Matthew', '41': 'Mark', '42': 'Luke',
    '43': 'John', '44': 'Acts', '45': 'Romans', '46': '1 Corinthians', '47': '2 Corinthians',
    '48': 'Galatians', '49': 'Ephesians', '50': 'Philippians', '51': 'Colossians',
    '52': '1 Thessalonians', '53': '2 Thessalonians', '54': '1 Timothy', '55': '2 Timothy',
    '56': 'Titus', '57': 'Philemon', '58': 'Hebrews', '59': 'James', '60': '1 Peter',
    '61': '2 Peter', '62': '1 John', '63': '2 John', '64': '3 John', '65': 'Jude',
    '66': 'Revelation',
}

/**
 * Extract book-only references from text (no chapter/verse required).
 * Matches patterns like "the Gospel of John", "the book of Romans",
 * "Gospel of Mark", or just standalone full book names in reading contexts.
 * Returns array of { bookName, bookId, url } objects.
 * Excludes any books already matched by extractScriptureReferences to avoid duplicates.
 */
export function extractBookReferences(
    text: string,
    excludeBooks?: Set<string>
): { bookName: string; bookId: string; url: string }[] {
    if (!text) return []

    const results: { bookName: string; bookId: string; url: string }[] = []
    const seen = new Set<string>()

    // Pattern 1: "the Gospel of X", "the book of X", "Gospel of X", "Book of X"
    const gospelBookPattern = /(?:the\s+)?(?:gospel|book|epistle|letter)\s+(?:of|to)\s+(\w+)/gi
    let match: RegExpExecArray | null
    while ((match = gospelBookPattern.exec(text)) !== null) {
        const bookNameRaw = match[1].toLowerCase()
        const bookId = BOOK_MAP[bookNameRaw]
        if (bookId && !seen.has(bookId) && !excludeBooks?.has(bookId)) {
            seen.add(bookId)
            const displayName = BOOK_ID_TO_NAME[bookId] || match[1]
            results.push({
                bookName: displayName,
                bookId,
                url: `/dashboard/bible?book=${bookId}&chapter=1`,
            })
        }
    }

    // Pattern 2: Full book names (5+ chars to avoid false positives) preceded by word boundary
    // Only match if they appear near reading-related words
    const readingContext = /read|study|reading|bible|scripture|chapter|memorize|meditat/i.test(text)
    if (readingContext) {
        const fullBookNames = Object.entries(BOOK_MAP)
            .filter(([name]) => name.length >= 5 && !/^\d/.test(name))
        // Sort by name length descending
        fullBookNames.sort((a, b) => b[0].length - a[0].length)

        for (const [name, id] of fullBookNames) {
            if (seen.has(id) || excludeBooks?.has(id)) continue
            // Check if this book name appears as a standalone word in text
            const nameRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
            if (nameRegex.test(text)) {
                // Make sure it's not already part of a "Book Chapter:Verse" pattern (handled by extractScriptureReferences)
                const fullRefRegex = new RegExp(
                    `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+\\d+`,
                    'i'
                )
                if (!fullRefRegex.test(text)) {
                    seen.add(id)
                    const displayName = BOOK_ID_TO_NAME[id] || name
                    results.push({
                        bookName: displayName,
                        bookId: id,
                        url: `/dashboard/bible?book=${id}&chapter=1`,
                    })
                }
            }
        }
    }

    return results
}

/**
 * Parse a scripture reference like "John 3:16" or "1 Corinthians 13:1-13"
 * into a Bible reader URL path with query params including verse range.
 */
export function scriptureToUrl(reference: string): string | null {
    if (!reference) return null

    // Strip any embedded text after ' - "' (e.g. 'John 3:3-7 - "Jesus answered..."')
    const cleanRef = reference.split(/\s*-\s*\u201C|\s*-\s*"/)[0].trim()

    // Match patterns: "John 3:16", "1 Corinthians 13", "Genesis 1:1-10", "Psalm 23"
    const match = cleanRef.match(/^(.+?)\s+(\d+)(?::(\d+(?:\s*-\s*\d+)?))?$/)
    if (!match) return null

    const bookName = match[1].trim().toLowerCase()
    const chapter = match[2]
    const verseRange = match[3]?.replace(/\s/g, '') || null

    const bookId = BOOK_MAP[bookName]
    if (!bookId) return null

    let url = `/dashboard/bible?book=${bookId}&chapter=${chapter}`
    if (verseRange) {
        url += `&verses=${verseRange}`
    }
    return url
}
