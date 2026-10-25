import 'server-only'

import { generateObject } from 'ai'
import { z } from 'zod'
import {
    DAILY_PRAYER_AI_MODEL,
    DAILY_PRAYER_AI_TIMEOUT_MS,
    DAILY_PRAYER_MAX_OUTPUT_TOKENS,
    DAILY_PRAYER_SYSTEM,
    buildDailyPrayerPrompt,
    type DailyPrayerDraft,
    type DailyPrayerGenerateRequest,
} from './daily-prayer-generate.ts'

const draftSchema = z.object({
    body: z.string().min(20),
    scriptureRef: z.string().min(3),
})

export async function generateDailyPrayerDraft(
    request: DailyPrayerGenerateRequest,
): Promise<DailyPrayerDraft> {
    const { object } = await generateObject({
        model: DAILY_PRAYER_AI_MODEL,
        schema: draftSchema,
        schemaName: 'DailyPrayer',
        system: DAILY_PRAYER_SYSTEM,
        prompt: buildDailyPrayerPrompt(request),
        timeout: DAILY_PRAYER_AI_TIMEOUT_MS,
        maxOutputTokens: DAILY_PRAYER_MAX_OUTPUT_TOKENS,
        maxRetries: 1,
    })
    return {
        body: object.body,
        scriptureRef: object.scriptureRef,
    }
}
