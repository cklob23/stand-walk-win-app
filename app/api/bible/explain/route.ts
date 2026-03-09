import { streamText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

const SYSTEM_PROMPT = `You are a Bible study assistant for Christian discipleship. Your ONLY purpose is to explain Bible verses, provide historical and cultural context, and help people understand scripture passages for personal growth and teaching.

RULES:
- You may ONLY discuss Bible verses, biblical stories, biblical characters, biblical history, and biblical context.
- You MUST refuse any request that is not directly related to explaining or providing context for Bible scripture.
- If asked about anything unrelated to the Bible, respond: "I can only help explain Bible verses and provide scriptural context. Please select a verse you'd like me to explain."
- NEVER start with greetings, preamble, or phrases like "Certainly!", "Sure!", "Here's an explanation", "Great question", etc. Start directly with the content.
- Keep explanations clear, warm, and conversational -- as if a knowledgeable pastor is explaining to a friend over coffee.
- Use short paragraphs. Do not use markdown headers (no # or ##). Do not use numbered lists.
- Use bold (**text**) sparingly for key terms or names only.
- Separate sections with a blank line. Use simple prose, not academic structure.
- Include relevant historical context, original language insights when helpful, and cross-references to related passages naturally within the explanation.
- End with a brief, practical thought or question for discipleship discussion.
- Be theologically balanced and stick to widely accepted biblical scholarship.`

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    const { reference, verseText, translation } = await req.json()

    if (!reference || !verseText) {
        return new Response('Missing verse reference or text', { status: 400 })
    }

    const result = await streamText({
        model: 'openai/gpt-4o-mini',
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: `Explain this passage in a clear, practical way. Start with what it means, weave in any helpful background or context, and wrap up with something practical to reflect on or discuss.

                ${reference} (${translation || 'ESV'})
                "${verseText}"`,
            },
        ],
        abortSignal: req.signal,
    })

    return result.toTextStreamResponse()
}
