/**
 * Prompt, validate, and cache-or-fallback for a once-a-day AI prayer.
 * The AI SDK call lives in daily-prayer-ai.ts so tests can inject a generator.
 */

import {
    buildDailyPrayer,
    clampPrayerBody,
    countWords,
    firstName,
    insertPartnerSentence,
    lookupCatalogVerse,
    MAX_PRAYER_WORDS,
    PARTNER_MENTION_SENTENCE,
    sanitizeVersePair,
    shouldMentionPartner,
    uniqueDailyPrayerVerses,
    type DailyPrayerContent,
    type DailyPrayerInput,
} from './daily-prayer-content.ts'

export const DAILY_PRAYER_AI_MODEL = 'openai/gpt-4o-mini'
export const DAILY_PRAYER_AI_TIMEOUT_MS = 8000
export const DAILY_PRAYER_RECENT_LIMIT = 14

export type DailyPrayerOrigin = 'cache' | 'ai' | 'catalog'
export type DailyPrayerGeneratedBy = 'ai' | 'catalog'

export interface DailyPrayerDraft {
    body: string
    scriptureRef: string
}

export interface DailyPrayerGenerateRequest {
    prayerInput: DailyPrayerInput
    recentBodies: string[]
}

export const DAILY_PRAYER_SYSTEM = `You write a short first-person Christian prayer for Stand Walk Run, a discipleship app.
Return JSON only.
Rules:
- Start with "Heavenly Father"
- End with "In Jesus' name I pray, Amen."
- 4 to 6 sentences, 70 words or fewer including the Amen
- Warm, specific, and different from the recent prayers you are given
- Do not mention any partner, learner, leader, or given name
- Do not use em dashes, ellipses, or the words petition / NIV
- Pick scriptureRef from the allowed ESV list only. Do not rewrite the verse.`

export function prayerTextKey(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function isRepeatedPrayer(body: string, recentBodies: string[]): boolean {
    const key = prayerTextKey(body)
    if (!key) return false
    return recentBodies.some((recent) => {
        const other = prayerTextKey(recent)
        if (!other) return false
        if (other === key) return true
        if (key.length >= 40 && other.includes(key)) return true
        if (other.length >= 40 && key.includes(other)) return true
        return false
    })
}

export function buildDailyPrayerPrompt(input: DailyPrayerGenerateRequest): string {
    const { prayerInput, recentBodies } = input
    const verses = uniqueDailyPrayerVerses()
        .map((verse) => `- ${verse.ref}: ${verse.text}`)
        .join('\n')
    const recent = recentBodies.length
        ? recentBodies.map((body, index) => `${index + 1}. ${body}`).join('\n')
        : '(none)'
    const topic = prayerInput.prayerItems?.trim() || prayerInput.reflection?.trim() || ''
    const week = prayerInput.weekNumber && prayerInput.weekTitle
        ? `Week ${prayerInput.weekNumber}: ${prayerInput.weekTitle}`
        : 'none'
    return [
        `Local date: ${prayerInput.dateKey}`,
        `Journal topic: ${topic || 'none'}`,
        `Current week: ${week}`,
        `Week scripture: ${prayerInput.weekScripture || 'none'}`,
        '',
        'Allowed ESV verses (use one scriptureRef exactly):',
        verses,
        '',
        'Do not repeat or closely rewrite these recent prayers:',
        recent,
        '',
        'Write a new prayer for this person today.',
    ].join('\n')
}

export function finalizeGeneratedPrayer(
    draft: DailyPrayerDraft,
    prayerInput: DailyPrayerInput,
    recentBodies: string[] = [],
): DailyPrayerContent | null {
    const fallback = buildDailyPrayer(prayerInput)
    const rawBody = (draft.body || '').replace(/[\u2014\u2013]/g, ',').trim()
    const withOpening = /^Heavenly Father/i.test(rawBody)
        ? rawBody
        : rawBody
            ? `Heavenly Father, ${rawBody.replace(/^[,.\s]+/, '')}`
            : ''
    let body = clampPrayerBody(withOpening, undefined, MAX_PRAYER_WORDS, PARTNER_MENTION_SENTENCE)
    if (!body) return null
    if (isRepeatedPrayer(body, [...recentBodies, fallback.body])) return null

    let mentionsPartner = shouldMentionPartner({
        dateKey: prayerInput.dateKey,
        source: fallback.source,
        partnerName: prayerInput.partnerName,
    })
    if (mentionsPartner && prayerInput.partnerName) {
        body = insertPartnerSentence(body, prayerInput.partnerName)
        body = clampPrayerBody(body, undefined, MAX_PRAYER_WORDS, PARTNER_MENTION_SENTENCE) || body
    }
    mentionsPartner = PARTNER_MENTION_SENTENCE.test(body)
    if (!/^Heavenly Father/i.test(body)) return null
    if (countWords(body) > MAX_PRAYER_WORDS) return null

    const catalog = lookupCatalogVerse(draft.scriptureRef)
    const verse = sanitizeVersePair(
        catalog || { text: fallback.scriptureText, ref: fallback.scriptureRef },
    )
    if (!verse.ref || (!verse.text && !catalog)) return null

    return {
        ...fallback,
        body,
        scriptureText: verse.text,
        scriptureRef: verse.ref,
        mentionsPartner,
    }
}

export async function resolveTodaysPrayer(input: {
    prayerInput: DailyPrayerInput
    cached?: DailyPrayerContent | null
    recentBodies?: string[]
    generate?: (request: DailyPrayerGenerateRequest) => Promise<DailyPrayerDraft>
}): Promise<{ content: DailyPrayerContent; origin: DailyPrayerOrigin }> {
    if (input.cached) return { content: input.cached, origin: 'cache' }

    const fallback = buildDailyPrayer(input.prayerInput)
    const recentBodies = input.recentBodies || []
    const request: DailyPrayerGenerateRequest = {
        prayerInput: input.prayerInput,
        recentBodies: [...recentBodies, fallback.body],
    }

    if (input.generate) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const draft = await input.generate(request)
                const content = finalizeGeneratedPrayer(draft, input.prayerInput, request.recentBodies)
                if (content) return { content, origin: 'ai' }
            } catch {
                break
            }
        }
    }

    return { content: fallback, origin: 'catalog' }
}

export function dailyPrayerCacheKey(userId: string, pairingId: string, localDate: string): string {
    return `${userId}:${pairingId}:${localDate}`
}

export function partnerDisplayName(fullName: string | null | undefined): string {
    return firstName(fullName)
}
