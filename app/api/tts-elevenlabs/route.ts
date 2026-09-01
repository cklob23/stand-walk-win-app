import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for verse audio (same text + voice + speed = same audio)
const audioCache = new Map<string, { buffer: ArrayBuffer; timestamp: number }>()
const CACHE_MAX_SIZE = 200
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

// ElevenLabs premade voice IDs allowed for the Bible reader. Keeping an
// allow-list prevents arbitrary voice IDs from being proxied through our key.
const ALLOWED_VOICE_IDS = new Set([
    'JBFqnCBsd6RMkjVDRZzb', // George
    'nPczCjzI2devNBz1zQrb', // Brian
    'onwK4e9ZLuTAKqWW03F9', // Daniel
    'pqHfZKP75CvOlQylNhV4', // Bill
    'pNInz6obpgDQGcFmaJgB', // Adam
    'EXAVITQu4vr4xnSDxMaL', // Sarah
    'XrExE9yKIg1WjnnlVkGX', // Matilda
    'Xb7hH8MSUJpSbSDYk0k2', // Alice
    'hpp4J3VqNfWAUOO0d1Us', // Bella
    'pFZP5JQG7iQjIQuC4Bku', // Lily
])

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb' // George
const MODEL_ID = 'eleven_turbo_v2_5' // fast, natural, supports the speed setting

function pruneCache() {
    if (audioCache.size <= CACHE_MAX_SIZE) return
    const now = Date.now()
    for (const [key, entry] of audioCache) {
        if (now - entry.timestamp > CACHE_TTL) audioCache.delete(key)
    }
    if (audioCache.size > CACHE_MAX_SIZE) {
        const entries = [...audioCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
        const toRemove = entries.slice(0, entries.length - CACHE_MAX_SIZE)
        for (const [key] of toRemove) audioCache.delete(key)
    }
}

export async function POST(request: NextRequest) {
    try {
        const { text, voice, speed: rawSpeed } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        // Validate voice against the allow-list, falling back to the default.
        const voiceId = typeof voice === 'string' && ALLOWED_VOICE_IDS.has(voice) ? voice : DEFAULT_VOICE_ID

        // ElevenLabs supports a speed setting in the 0.7 - 1.2 range.
        const speed = Math.min(1.2, Math.max(0.7, typeof rawSpeed === 'number' ? rawSpeed : 1.0))

        // Limit to a single batch size (generous cap).
        const trimmedText = text.slice(0, 1500)

        const cacheKey = `${voiceId}:${speed}:${trimmedText}`
        const cached = audioCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return new NextResponse(cached.buffer, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'public, max-age=3600',
                    'X-Cache': 'HIT',
                },
            })
        }

        const apiKey = process.env.ELEVENLABS_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'TTS API key not configured' }, { status: 500 })
        }

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: trimmedText,
                    model_id: MODEL_ID,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true,
                        speed,
                    },
                }),
            }
        )

        if (!response.ok) {
            const errorBody = await response.text()
            console.error('[v0] ElevenLabs TTS API error:', response.status, errorBody)
            return NextResponse.json({ error: 'TTS synthesis failed' }, { status: response.status })
        }

        const buffer = await response.arrayBuffer()

        pruneCache()
        audioCache.set(cacheKey, { buffer: buffer.slice(0), timestamp: Date.now() })

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
                'X-Cache': 'MISS',
            },
        })
    } catch (error) {
        console.error('[v0] ElevenLabs TTS route error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
