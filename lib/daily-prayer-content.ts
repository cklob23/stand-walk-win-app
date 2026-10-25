/**
 * Compose Today's prayer from journal / week / encouragement sources.
 * The catalog here is the fallback when AI generation is unavailable.
 * Partner is mentioned only occasionally (about 1 in 5 or fewer).
 */

export type DailyPrayerSource = 'journal' | 'week' | 'encouragement'

export interface DailyPrayerPartner {
    pairingId: string
    userId: string
    name: string
}

export interface DailyPrayerInput {
    dateKey: string
    prayerItems?: string | null
    reflection?: string | null
    weekNumber?: number | null
    weekTitle?: string | null
    weekScripture?: string | null
    assignmentTitle?: string | null
    guidedPrayer?: string | null
    partnerName?: string | null
}

export interface DailyPrayerContent {
    body: string
    scriptureText: string
    scriptureRef: string
    source: DailyPrayerSource
    contextLabel: string
    contextTopic: string | null
    mentionsPartner: boolean
}

export const PARTNER_MENTION_MODULUS = 5

const AMEN_TAIL = /In Jesus['\u2019] name I pray,?\s*Amen\.?\s*$/i

const ENCOURAGEMENT_PRAYERS: { body: string; scriptureText: string; scriptureRef: string }[] = [
    {
        body: "Heavenly Father, thank You for meeting me in the middle of my workday. Give me Your peace where anxiety has been loud, and help me trust You with the conversations on my heart. Teach me to slow down and listen for Your voice today. In Jesus' name I pray, Amen.",
        scriptureText: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
        scriptureRef: 'Philippians 4:6-7',
    },
    {
        body: "Heavenly Father, thank You for Your steadfast love in the morning. Quiet my heart so I can hear You, and help me take one faithful step in love toward others. Keep me close as I walk through this day. In Jesus' name I pray, Amen.",
        scriptureText: 'Let me hear in the morning of your steadfast love, for in you I trust. Make me know the way I should go, for to you I lift up my soul.',
        scriptureRef: 'Psalm 143:8',
    },
    {
        body: "Heavenly Father, thank You that Your mercies are new this morning. Strengthen my hands for the work in front of me and keep my heart soft toward You. Help me notice Your kindness and share it freely. In Jesus' name I pray, Amen.",
        scriptureText: 'The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.',
        scriptureRef: 'Lamentations 3:22-23',
    },
    {
        body: "Heavenly Father, thank You that I do not walk today in my own strength. Hold me when I feel weak, and remind me that You are with me. Help me speak with grace and rest in Your care. In Jesus' name I pray, Amen.",
        scriptureText: 'Fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.',
        scriptureRef: 'Isaiah 41:10',
    },
]

const WEEK_SCRIPTURES: Record<string, { text: string; ref: string }> = {
    'john 3:3-7': {
        text: 'Jesus answered him, Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God.',
        ref: 'John 3:3',
    },
    '2 corinthians 5:17': {
        text: 'Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.',
        ref: '2 Corinthians 5:17',
    },
    'ephesians 6:10-18': {
        text: 'Finally, be strong in the Lord and in the strength of his might. Put on the whole armor of God, that you may be able to stand against the schemes of the devil.',
        ref: 'Ephesians 6:10-11',
    },
    'colossians 2:6-7': {
        text: 'Therefore, as you received Christ Jesus the Lord, so walk in him, rooted and built up in him and established in the faith, just as you were taught, abounding in thanksgiving.',
        ref: 'Colossians 2:6-7',
    },
    '1 john 5:4-5': {
        text: 'For everyone who has been born of God overcomes the world. And this is the victory that has overcome the world, our faith.',
        ref: '1 John 5:4',
    },
    '1 peter 3:15': {
        text: 'But in your hearts honor Christ the Lord as holy, always being prepared to make a defense to anyone who asks you for a reason for the hope that is in you; yet do it with gentleness and respect.',
        ref: '1 Peter 3:15',
    },
    'philippians 4:6-7': {
        text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.',
        ref: 'Philippians 4:6-7',
    },
}

/** Every catalog verse used by Today's prayer. Tests audit these for ellipses. */
export function listDailyPrayerVerses(): { text: string; ref: string }[] {
    return [
        ...ENCOURAGEMENT_PRAYERS.map((prayer) => ({
            text: prayer.scriptureText,
            ref: prayer.scriptureRef,
        })),
        ...Object.values(WEEK_SCRIPTURES),
    ]
}

/** Deduped ESV catalog for the daily-prayer prompt. */
export function uniqueDailyPrayerVerses(): { text: string; ref: string }[] {
    const seen = new Set<string>()
    const verses: { text: string; ref: string }[] = []
    for (const verse of listDailyPrayerVerses()) {
        const key = verse.ref.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        verses.push(verse)
    }
    return verses
}

function normalizeVerseRef(ref: string): string {
    return ref.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function lookupCatalogVerse(ref: string | null | undefined): { text: string; ref: string } | null {
    if (!ref) return null
    const key = normalizeVerseRef(ref)
    if (WEEK_SCRIPTURES[key]) return WEEK_SCRIPTURES[key]
    for (const entry of listDailyPrayerVerses()) {
        if (normalizeVerseRef(entry.ref) === key) return entry
    }
    return null
}

export function verseHasEllipsis(text: string | null | undefined): boolean {
    return /\.\.\.|\u2026/.test(text || '')
}

/**
 * DB dumps can be truncated. Prefer the ESV catalog; if we have no catalog
 * match, drop the quote and keep the reference only.
 */
export function sanitizeVersePair(input: { text: string; ref: string }): { text: string; ref: string } {
    const ref = extractScriptureRef(input.ref) || input.ref
    const text = scriptureDisplayText(input.text)
    if (!verseHasEllipsis(text)) return { text, ref }
    const catalog = lookupCatalogVerse(ref)
    if (catalog) return { text: scriptureDisplayText(catalog.text), ref: catalog.ref }
    return { text: '', ref }
}

export function hashString(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) >>> 0
    }
    return hash
}

const HONORIFIC_RE = /^(?:dr|mr|mrs|ms|miss|st|pastor|rev|reverend|fr|father|prof|professor)\.?$/i

/** Given name after Dr./Mr./Mrs./Ms./Pastor, so "Dr. Bob" does not become "Dr." */
export function firstName(fullName: string | null | undefined): string {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return ''
    let index = 0
    while (index < parts.length && HONORIFIC_RE.test(parts[index])) {
        index++
    }
    return parts[index] || parts[0]
}

export function sendPrayerButtonLabel(partnerName: string | null | undefined): string {
    const name = firstName(partnerName)
    return name ? `Send to ${name}` : 'Send to partner'
}

export function stripEmDashes(text: string): string {
    return text.replace(/[\u2014\u2013]/g, ',')
}

export function extractJournalTopic(
    prayerItems?: string | null,
    reflection?: string | null,
): string | null {
    const fromItems = firstPrayerItem(prayerItems)
    if (fromItems) return shortenTopic(fromItems)

    const fromReflection = firstMeaningfulLine(reflection)
    if (fromReflection) return shortenTopic(fromReflection)

    return null
}

export function firstPrayerItem(prayerItems?: string | null): string | null {
    if (!prayerItems?.trim()) return null
    const lines = prayerItems
        .split(/\n+/)
        .map((line) => line.replace(/^\s*(?:\d+[\).:-]|[-*•])\s*/, '').trim())
        .filter(Boolean)
    return lines[0] || null
}

function firstMeaningfulLine(text?: string | null): string | null {
    if (!text?.trim()) return null
    const daily = text.split(/\n\n---\n\n/)[0] || ''
    const line = daily
        .split(/\n+/)
        .map((part) => part.trim())
        .find((part) => part.length > 0)
    return line || null
}

export function shortenTopic(raw: string, max = 32): string {
    const cleaned = raw.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length <= max) return cleaned.replace(/[.,;:]+$/, '')
    const sliced = cleaned.slice(0, max - 1)
    const atSpace = sliced.lastIndexOf(' ')
    const cut = atSpace > 12 ? sliced.slice(0, atSpace) : sliced
    return cut.replace(/[.,;:]+$/, '')
}

export const MAX_PRAYER_SENTENCES = 6
export const MIN_PRAYER_SENTENCES = 4
export const MAX_PRAYER_WORDS = 70
const AMEN_LINE = "In Jesus' name I pray, Amen."

export function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])(?<![A-Z]\.)\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
}

export function countSentences(text: string): number {
    return splitSentences(text).length
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

export function stripDashSeparators(text: string): string {
    return text.replace(/\s+-\s+/g, ' ')
}

export function extractScriptureRef(raw: string | null | undefined): string | null {
    if (!raw?.trim()) return null
    const normalized = raw.replace(/[\u201C\u201D]/g, '"').trim()
    const beforeDash = normalized.split(/\s+-\s+/)[0].trim().replace(/^["']|["']$/g, '')
    const match = beforeDash.match(/^((?:[1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+:\d+(?:-\d+)?)/)
    if (!match) return beforeDash || null
    return `${match[1]} ${match[2]}`.replace(/\s+/g, ' ')
}

export function singleVerseText(text: string | null | undefined): string {
    if (!text) return ''
    const cleaned = scriptureDisplayText(text)
    return splitSentences(cleaned)[0] || cleaned
}

/** Full verse or range text, without chopping the first sentence only. */
export function scriptureDisplayText(text: string | null | undefined): string {
    if (!text) return ''
    return stripDashSeparators(stripEmDashes(text)).replace(/^["\u201C]|["\u201D]$/g, '').trim()
}

export function trimSentenceToWords(sentence: string, maxWords: number): string {
    const words = sentence.replace(/[.!?]+$/, '').trim().split(/\s+/).filter(Boolean)
    if (words.length <= maxWords) {
        return /[.!?]$/.test(sentence.trim()) ? sentence.trim() : `${sentence.trim()}.`
    }
    return `${words.slice(0, Math.max(1, maxWords)).join(' ')}.`
}

/** Keep Heavenly Father ... Amen, never more than `max` sentences or ~70 words. */
export function clampPrayerBody(
    body: string,
    max = MAX_PRAYER_SENTENCES,
    maxWords = MAX_PRAYER_WORDS,
    keepPattern?: RegExp,
): string | null {
    const cleaned = stripDashSeparators(stripEmDashes(body)).trim()
    if (!/^Heavenly Father/i.test(cleaned)) return null
    let sentences = splitSentences(cleaned)
    if (sentences.length && /Amen\.?\s*$/i.test(sentences[sentences.length - 1])) {
        sentences = sentences.slice(0, -1)
    }
    if (sentences.length === 0) return null
    const isOpening = (sentence: string) => /^Heavenly Father/i.test(sentence)
    const room = Math.max(1, max - 1)
    if (sentences.length > room) {
        const opening = sentences.find(isOpening)
        const kept = keepPattern
            ? sentences.filter((sentence) => keepPattern.test(sentence) && !isOpening(sentence))
            : []
        const others = sentences.filter((sentence) => sentence !== opening && !kept.includes(sentence))
        const extra = Math.max(0, room - 1 - kept.length)
        sentences = [opening, ...others.slice(0, extra), ...kept].filter((sentence): sentence is string => !!sentence)
    }
    const overCap = () => countWords(`${sentences.join(' ')} ${AMEN_LINE}`) > maxWords
    while (sentences.length > 1 && overCap()) {
        const keepIdx = keepPattern ? sentences.findIndex((sentence) => keepPattern.test(sentence)) : -1
        let removed = false
        for (let i = sentences.length - 1; i >= 0; i--) {
            if (i === keepIdx) continue
            if (isOpening(sentences[i])) continue
            sentences.splice(i, 1)
            removed = true
            break
        }
        if (!removed) break
    }
    if (overCap()) {
        const amenWords = countWords(AMEN_LINE)
        const opening = sentences.find(isOpening) || sentences[0]
        const partner = keepPattern
            ? sentences.filter((sentence) => keepPattern.test(sentence) && !isOpening(sentence))
            : []
        const reserved = partner.reduce((sum, sentence) => sum + countWords(sentence), 0)
        const budget = Math.max(3, maxWords - amenWords - reserved)
        const trimmed = trimSentenceToWords(opening, budget)
        const openingOut = /^Heavenly Father/i.test(trimmed)
            ? trimmed
            : `Heavenly Father, ${trimmed}`
        sentences = [openingOut, ...partner]
    }
    return `${sentences.join(' ')} ${AMEN_LINE}`
}

export function isShortGuidedPrayer(text?: string | null): boolean {
    if (!text?.trim()) return false
    const trimmed = text.trim()
    if (!/^Heavenly Father/i.test(trimmed)) return false
    const sentences = countSentences(trimmed)
    return sentences >= 3 && sentences <= 6
}

function bodyFromGuidedPrayer(guided: string | null | undefined, weekTitle: string): string {
    const raw = guided?.trim()
    if (!raw) return weekPrayer(weekTitle)
    const sentences = splitSentences(raw)
    const contentCount = sentences.length && /Amen\.?\s*$/i.test(sentences[sentences.length - 1])
        ? sentences.length - 1
        : sentences.length
    const max = contentCount > 3 ? MIN_PRAYER_SENTENCES : MAX_PRAYER_SENTENCES
    return clampPrayerBody(raw, max) || weekPrayer(weekTitle)
}

/**
 * Mention the partner at most 1 in 5 days, never by default, and only when
 * the prayer already has a personal journal or week topic to attach to.
 */
export function shouldMentionPartner(input: {
    dateKey: string
    source: DailyPrayerSource
    partnerName?: string | null
}): boolean {
    if (!firstName(input.partnerName)) return false
    if (input.source === 'encouragement') return false
    const parts = input.dateKey.split('-').map(Number)
    const year = parts[0]
    const month = parts[1]
    const day = parts[2]
    if (!year || !month || !day) return false
    const utc = Date.UTC(year, month - 1, day)
    const start = Date.UTC(year, 0, 0)
    const dayOfYear = Math.round((utc - start) / 86_400_000)
    return dayOfYear % PARTNER_MENTION_MODULUS === 0
}

export function insertPartnerSentence(body: string, partnerName: string): string {
    const name = firstName(partnerName)
    if (!name) return body
    const sentence = `Strengthen my friendship with ${name} as we walk this journey.`
    const sanitized = stripEmDashes(body).trim()
    const match = sanitized.match(AMEN_TAIL)
    if (match && match.index != null) {
        const before = sanitized.slice(0, match.index).trim()
        return `${before} ${sentence} ${normalizeAmen(match[0])}`
    }
    return `${sanitized} ${sentence} In Jesus' name I pray, Amen.`
}

function normalizeAmen(tail: string): string {
    return /Amen\.?\s*$/i.test(tail) ? "In Jesus' name I pray, Amen." : tail.trim()
}

function journalPrayer(topic: string): string {
    return `Heavenly Father, thank You for this new day and for the chance to bring You what is on my heart. I lift up ${topic} to You and ask for wisdom, peace, and a willing spirit. Help me notice Your kindness in ordinary moments. Teach me to walk with You as I go. In Jesus' name I pray, Amen.`
}

function weekPrayer(weekTitle: string): string {
    return `Heavenly Father, thank You for a new day to walk with You. Quiet my heart to hear Your Word as I learn about ${weekTitle}. Help me take one faithful step in love toward others. Keep me faithful in the small things today. In Jesus' name I pray, Amen.`
}

function resolveWeekScripture(weekScripture?: string | null): { text: string; ref: string } | null {
    const ref = extractScriptureRef(weekScripture)
    if (!ref) return null
    const catalog = lookupCatalogVerse(ref)
    if (catalog) return { text: scriptureDisplayText(catalog.text), ref: catalog.ref }
    return parseScriptureDump(weekScripture)
}

/** Pull a paired verse + ref from "Book N:N - \"verse text\"". Never mix two sources. */
export function parseScriptureDump(raw?: string | null): { text: string; ref: string } | null {
    if (!raw?.trim()) return null
    const ref = extractScriptureRef(raw)
    const quoted = raw.replace(/[\u201C\u201D]/g, '"').match(/-\s*"([^"]+)"/)
    if (ref && quoted?.[1]) {
        return sanitizeVersePair({ text: quoted[1], ref })
    }
    return null
}

/** Verse text and reference always come from one pair. Never mix Psalm text with a 2 Cor ref. */
export function pairScripture(input: {
    raw?: string | null
    fallback: { text: string; ref: string }
}): { text: string; ref: string } {
    const mapped = resolveWeekScripture(input.raw)
    if (mapped) return sanitizeVersePair(mapped)
    return sanitizeVersePair({
        text: input.fallback.text,
        ref: extractScriptureRef(input.fallback.ref) || input.fallback.ref,
    })
}

export function buildDailyPrayer(input: DailyPrayerInput): DailyPrayerContent {
    const topic = extractJournalTopic(input.prayerItems, input.reflection)
    const weekTitle = input.weekTitle?.trim() || null
    const weekNumber = input.weekNumber && input.weekNumber > 0 ? input.weekNumber : null

    let source: DailyPrayerSource = 'encouragement'
    let body: string
    let scriptureText: string
    let scriptureRef: string
    let contextLabel: string
    let contextTopic: string | null = null

    if (topic) {
        source = 'journal'
        body = journalPrayer(topic)
        scriptureText = ENCOURAGEMENT_PRAYERS[0].scriptureText
        scriptureRef = ENCOURAGEMENT_PRAYERS[0].scriptureRef
        contextLabel = 'From your journal'
        contextTopic = topic
    } else if (weekNumber && weekTitle) {
        source = 'week'
        body = bodyFromGuidedPrayer(input.guidedPrayer, weekTitle)
        const weekScripture = pairScripture({
            raw: input.weekScripture,
            fallback: {
                text: ENCOURAGEMENT_PRAYERS[1].scriptureText,
                ref: ENCOURAGEMENT_PRAYERS[1].scriptureRef,
            },
        })
        scriptureText = weekScripture.text
        scriptureRef = weekScripture.ref
        contextLabel = `Week ${weekNumber}`
        contextTopic = weekTitle
    } else {
        const pick = ENCOURAGEMENT_PRAYERS[hashString(input.dateKey) % ENCOURAGEMENT_PRAYERS.length]
        source = 'encouragement'
        body = pick.body
        scriptureText = pick.scriptureText
        scriptureRef = pick.scriptureRef
        contextLabel = 'Encouragement for today'
        contextTopic = null
    }

    let mentionsPartner = shouldMentionPartner({
        dateKey: input.dateKey,
        source,
        partnerName: input.partnerName,
    })
    if (mentionsPartner && input.partnerName) {
        const partnerLine = `Strengthen my friendship with ${firstName(input.partnerName)} as we walk this journey.`
        const reserved = clampPrayerBody(
            body,
            MAX_PRAYER_SENTENCES - 1,
            MAX_PRAYER_WORDS - countWords(partnerLine),
        ) || body
        body = insertPartnerSentence(reserved, input.partnerName)
    }
    body = clampPrayerBody(body, MAX_PRAYER_SENTENCES, MAX_PRAYER_WORDS, PARTNER_MENTION_SENTENCE) || body
    mentionsPartner = PARTNER_MENTION_SENTENCE.test(body)
    const verse = sanitizeVersePair({ text: scriptureText, ref: scriptureRef })

    return {
        body: stripDashSeparators(stripEmDashes(body)),
        scriptureText: verse.text,
        scriptureRef: verse.ref,
        source,
        contextLabel,
        contextTopic: contextTopic ? stripDashSeparators(stripEmDashes(contextTopic)) : null,
        mentionsPartner,
    }
}

export function formatPrayerChip(content: DailyPrayerContent): string {
    if (content.source === 'journal' && content.contextTopic) {
        return `${content.contextLabel} · ${content.contextTopic}`
    }
    if (content.source === 'week' && content.contextTopic) {
        return `${content.contextLabel} · ${content.contextTopic}`
    }
    return content.contextLabel
}

export function formatPrayerDate(now: Date = new Date()): string {
    return now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

export const DAILY_PRAYER_MESSAGE_PREFIX = "Today's prayer"

export const PARTNER_MENTION_SENTENCE =
    /Strengthen my friendship with (\S+) as we walk this journey\./

/** Visible + textual gap between verse and reference. Not a dash. */
export const SCRIPTURE_LINE_SEPARATOR = ' '

export function formatScriptureLine(text: string, ref: string): string {
    const verse = text.trim()
    if (!verse) return ref
    return `${verse}${SCRIPTURE_LINE_SEPARATOR}${ref}`
}

export function formatPrayerMessage(
    content: Pick<DailyPrayerContent, 'body' | 'scriptureText' | 'scriptureRef'>,
): string {
    return `${DAILY_PRAYER_MESSAGE_PREFIX}\n\n${content.body}\n\n${formatScriptureLine(content.scriptureText, content.scriptureRef)}`
}

/** Swap the named partner, or drop the sentence if the recipient has no name. */
export function retargetPartnerMention(body: string, recipientName: string | null | undefined): string {
    const match = body.match(PARTNER_MENTION_SENTENCE)
    if (!match) return body
    const recipientFirst = firstName(recipientName)
    if (!recipientFirst) {
        return body.replace(/\s*Strengthen my friendship with \S+ as we walk this journey\./, '').trim()
    }
    if (match[1] === recipientFirst) return body
    return body.replace(match[0], `Strengthen my friendship with ${recipientFirst} as we walk this journey.`)
}

export function dailyReflectionText(godSpeaking?: string | null): string | null {
    if (!godSpeaking?.trim()) return null
    const daily = godSpeaking.split(/\n\n---\n\n/)[0]?.trim()
    return daily || null
}

export function resolveDailyPrayerInput(input: {
    prayerItems?: string | null
    reflection?: string | null
    journalEntries?: { prayer_items?: string | null; god_speaking?: string | null }[]
    weekNumber?: number | null
    weekTitle?: string | null
    weekScripture?: string | null
    assignmentTitle?: string | null
    guidedPrayer?: string | null
    assignments?: { week_number?: number; title?: string; guided_prayer?: string | null }[]
}): Omit<DailyPrayerInput, 'dateKey' | 'partnerName'> {
    let prayerItems = input.prayerItems ?? null
    let reflection = input.reflection ?? null

    if (!extractJournalTopic(prayerItems, reflection) && input.journalEntries) {
        for (const entry of input.journalEntries) {
            const daily = dailyReflectionText(entry.god_speaking)
            if (extractJournalTopic(entry.prayer_items, daily)) {
                prayerItems = entry.prayer_items ?? null
                reflection = daily
                break
            }
        }
    }

    const weekNumber = input.weekNumber && input.weekNumber > 0 ? input.weekNumber : null
    let assignmentTitle = input.assignmentTitle ?? null
    let guidedPrayer = input.guidedPrayer ?? null
    if (weekNumber && input.assignments?.length) {
        const weekRows = input.assignments.filter((row) => row.week_number === weekNumber)
        if (!guidedPrayer) {
            const withPrayer = weekRows.find((row) => isShortGuidedPrayer(row.guided_prayer) || !!row.guided_prayer?.trim())
            guidedPrayer = withPrayer?.guided_prayer ?? null
        }
        if (!assignmentTitle) {
            assignmentTitle = weekRows.find((row) => row.title?.trim())?.title ?? null
        }
    }

    return {
        prayerItems,
        reflection,
        weekNumber,
        weekTitle: input.weekTitle ?? null,
        weekScripture: input.weekScripture ?? null,
        assignmentTitle,
        guidedPrayer,
    }
}
