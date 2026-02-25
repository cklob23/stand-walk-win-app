import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for OpenAI TTS audio
const audioCache = new Map<string, { buffer: ArrayBuffer; timestamp: number }>()
const CACHE_MAX_SIZE = 200
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

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

const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']

export async function POST(request: NextRequest) {
    try {
        const { text, voice = 'nova', speed: rawSpeed } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        if (!VALID_VOICES.includes(voice)) {
            return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
        }

        // Clamp speed to OpenAI range (0.25 - 4.0)
        const speed = Math.min(4.0, Math.max(0.25, typeof rawSpeed === 'number' ? rawSpeed : 1.0))

        const trimmedText = text.slice(0, 4096) // OpenAI supports up to 4096 chars

        // Check cache
        const cacheKey = `openai:${voice}:${speed}:${trimmedText}`
        const cached = audioCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return new NextResponse(cached.buffer, {
                headers: {
                    'Content-Type': 'audio/mp3',
                    'Cache-Control': 'public, max-age=3600',
                    'X-Cache': 'HIT',
                },
            })
        }

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: trimmedText,
                voice,
                speed,
                response_format: 'mp3',
            }),
        })

        if (!response.ok) {
            const errorBody = await response.text()
            console.error('[v0] OpenAI TTS API error:', response.status, errorBody)
            return NextResponse.json({ error: 'TTS synthesis failed' }, { status: response.status })
        }

        const buffer = await response.arrayBuffer()

        // Cache it
        pruneCache()
        audioCache.set(cacheKey, { buffer: buffer.slice(0), timestamp: Date.now() })

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'audio/mp3',
                'Cache-Control': 'public, max-age=3600',
                'X-Cache': 'MISS',
            },
        })
    } catch (error) {
        console.error('[v0] OpenAI TTS route error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
