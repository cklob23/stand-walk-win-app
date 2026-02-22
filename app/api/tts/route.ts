import { NextResponse } from 'next/server'

// Google Cloud TTS voices curated for Bible reading
export const GOOGLE_TTS_VOICES = [
    { id: 'en-US-Wavenet-D', name: 'David', description: 'Warm male', gender: 'MALE' },
    { id: 'en-US-Wavenet-C', name: 'Clara', description: 'Clear female', gender: 'FEMALE' },
    { id: 'en-US-Wavenet-A', name: 'Adam', description: 'Deep male', gender: 'MALE' },
    { id: 'en-US-Wavenet-E', name: 'Emily', description: 'Gentle female', gender: 'FEMALE' },
    { id: 'en-US-Wavenet-B', name: 'Brian', description: 'Calm male', gender: 'MALE' },
    { id: 'en-US-Wavenet-F', name: 'Fiona', description: 'Bright female', gender: 'FEMALE' },
    { id: 'en-GB-Wavenet-B', name: 'James', description: 'British male', gender: 'MALE' },
    { id: 'en-GB-Wavenet-A', name: 'Charlotte', description: 'British female', gender: 'FEMALE' },
    { id: 'en-AU-Wavenet-B', name: 'Liam', description: 'Australian male', gender: 'MALE' },
    { id: 'en-AU-Wavenet-C', name: 'Sophie', description: 'Australian female', gender: 'FEMALE' },
] as const

const MAX_CHARS = 4500 // Google TTS limit is 5000 bytes; stay under

function chunkText(text: string): string[] {
    if (text.length <= MAX_CHARS) return [text]
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 0) {
        if (remaining.length <= MAX_CHARS) {
            chunks.push(remaining)
            break
        }
        // Find a natural break point (sentence end or newline) near the limit
        let breakAt = remaining.lastIndexOf('. ', MAX_CHARS)
        if (breakAt < MAX_CHARS * 0.5) breakAt = remaining.lastIndexOf('\n', MAX_CHARS)
        if (breakAt < MAX_CHARS * 0.5) breakAt = remaining.lastIndexOf(' ', MAX_CHARS)
        if (breakAt < 0) breakAt = MAX_CHARS
        chunks.push(remaining.slice(0, breakAt + 1))
        remaining = remaining.slice(breakAt + 1)
    }
    return chunks
}

async function synthesizeChunk(text: string, voice: string, apiKey: string): Promise<Buffer> {
    const languageCode = voice.split('-').slice(0, 2).join('-')
    const voiceConfig = GOOGLE_TTS_VOICES.find(v => v.id === voice)

    const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text },
                voice: {
                    languageCode,
                    name: voice,
                    ssmlGender: voiceConfig?.gender || 'NEUTRAL',
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 0.92,
                    pitch: 0,
                },
            }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[v0] Google TTS API error:', response.status, errorText)
        throw new Error(`TTS API error: ${response.status}`)
    }

    const data = await response.json()
    if (!data.audioContent) throw new Error('No audio returned')
    return Buffer.from(data.audioContent, 'base64')
}

export async function POST(request: Request) {
    try {
        const { text, voice = 'en-US-Wavenet-D' } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing text' }, { status: 400 })
        }

        const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Google Cloud TTS API key not configured. Add GOOGLE_CLOUD_TTS_API_KEY in your environment variables.' },
                { status: 500 }
            )
        }

        const chunks = chunkText(text)

        // Synthesize all chunks (in parallel for speed)
        const audioBuffers = await Promise.all(
            chunks.map(chunk => synthesizeChunk(chunk, voice, apiKey))
        )

        // Concatenate MP3 buffers
        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0)
        const combined = Buffer.concat(audioBuffers, totalLength)

        return new NextResponse(combined, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=86400',
            },
        })
    } catch (err) {
        console.error('[v0] TTS error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
