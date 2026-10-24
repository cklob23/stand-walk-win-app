/**
 * Compose Today's prayer from existing journal / week / encouragement sources.
 * No new AI dependency: reuses guided-prayer wording when it is already short,
 * otherwise fills a short user-focused template. Partner is mentioned only
 * occasionally (about 1 in 5 or fewer) and only when it fits the topic.
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
        scriptureText: 'Do not be anxious about anything, but in everything by prayer and petition, with thanksgiving, present your requests to God. And the peace of God... will guard your hearts.',
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
        scriptureText: 'Fear not, for I am with you; be not dismayed, for I am your God. I will strengthen you, I will help you, I will uphold you with my righteous right hand.',
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
        text: 'Finally, be strong in the Lord and in the strength of his might. Put on the whole armor of God.',
        ref: 'Ephesians 6:10-11',
    },
    'colossians 2:6-7': {
        text: 'Therefore, as you received Christ Jesus the Lord, so walk in him, rooted and built up in him and established in the faith.',
        ref: 'Colossians 2:6-7',
    },
    '1 john 5:4-5': {
        text: 'For everyone who has been born of God overcomes the world. And this is the victory that has overcome the world: our faith.',
        ref: '1 John 5:4',
    },
    '1 peter 3:15': {
        text: 'In your hearts honor Christ the Lord as holy, always being prepared to make a defense to anyone who asks you for a reason for the hope that is in you.',
        ref: '1 Peter 3:15',
    },
}

export function hashString(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) >>> 0
    }
    return hash
}

export function firstName(fullName: string | null | undefined): string {
    const trimmed = (fullName || '').trim()
    if (!trimmed) return ''
    return trimmed.split(/\s+/)[0]
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

export function countSentences(text: string): number {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean).length
}

export function isShortGuidedPrayer(text?: string | null): boolean {
    if (!text?.trim()) return false
    const trimmed = text.trim()
    if (!/^Heavenly Father/i.test(trimmed)) return false
    const sentences = countSentences(trimmed)
    return sentences >= 3 && sentences <= 6
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
    if (!weekScripture?.trim()) return null
    const key = weekScripture.trim().toLowerCase()
    return WEEK_SCRIPTURES[key] || null
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
        body = isShortGuidedPrayer(input.guidedPrayer)
            ? stripEmDashes(input.guidedPrayer!.trim())
            : weekPrayer(weekTitle)
        const weekScripture = resolveWeekScripture(input.weekScripture)
        scriptureText = weekScripture?.text || ENCOURAGEMENT_PRAYERS[1].scriptureText
        scriptureRef = weekScripture?.ref || input.weekScripture?.trim() || ENCOURAGEMENT_PRAYERS[1].scriptureRef
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

    const mentionsPartner = shouldMentionPartner({
        dateKey: input.dateKey,
        source,
        partnerName: input.partnerName,
    })
    if (mentionsPartner && input.partnerName) {
        body = insertPartnerSentence(body, input.partnerName)
    }

    return {
        body: stripEmDashes(body),
        scriptureText: stripEmDashes(scriptureText),
        scriptureRef: stripEmDashes(scriptureRef),
        source,
        contextLabel,
        contextTopic: contextTopic ? stripEmDashes(contextTopic) : null,
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
    /Strengthen my friendship with ([^\s.]+) as we walk this journey\./

export function formatPrayerMessage(
    content: Pick<DailyPrayerContent, 'body' | 'scriptureText' | 'scriptureRef'>,
): string {
    return `${DAILY_PRAYER_MESSAGE_PREFIX}\n\n${content.body}\n\n${content.scriptureText} ${content.scriptureRef}`
}

/** Swap the named partner, or drop the sentence if the recipient has no name. */
export function retargetPartnerMention(body: string, recipientName: string | null | undefined): string {
    const match = body.match(PARTNER_MENTION_SENTENCE)
    if (!match) return body
    const recipientFirst = firstName(recipientName)
    if (!recipientFirst) {
        return body.replace(/\s*Strengthen my friendship with [^.]+ as we walk this journey\./, '').trim()
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
