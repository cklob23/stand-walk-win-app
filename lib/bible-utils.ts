// Maps common Bible book names to Bolls.life numeric book IDs
// Standard Protestant canon: Genesis=1 ... Revelation=66
const BOOK_MAP: Record<string, string> = {
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
