import { NextRequest, NextResponse } from 'next/server'

// In-memory cache for verse audio (same text + voice = same audio)
const audioCache = new Map<string, { buffer: ArrayBuffer; timestamp: number }>()
const CACHE_MAX_SIZE = 200
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function pruneCache() {
    if (audioCache.size <= CACHE_MAX_SIZE) return
    const now = Date.now()
    // Remove expired entries first
    for (const [key, entry] of audioCache) {
        if (now - entry.timestamp > CACHE_TTL) audioCache.delete(key)
    }
    // If still too large, remove oldest entries
    if (audioCache.size > CACHE_MAX_SIZE) {
        const entries = [...audioCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
        const toRemove = entries.slice(0, entries.length - CACHE_MAX_SIZE)
        for (const [key] of toRemove) audioCache.delete(key)
    }
}

export async function POST(request: NextRequest) {
    try {
        const { text, voice = 'en-US-Wavenet-D' } = await request.json()

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        // Limit to single-verse size (~500 chars max, generous)
        const trimmedText = text.slice(0, 1000)

        // Check cache
        const cacheKey = `${voice}:${trimmedText}`
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

        const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'TTS API key not configured' }, { status: 500 })
        }

        // Determine language code from voice name
        const langCode = voice.match(/^([a-z]{2}-[A-Z]{2})/)?.[1] || 'en-US'

        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: trimmedText },
                    voice: {
                        languageCode: langCode,
                        name: voice,
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 0.92,
                        pitch: 0.0,
                        volumeGainDb: 0.0,
                    },
                }),
            }
        )

        if (!response.ok) {
            const errorBody = await response.text()
            console.error('[v0] Google TTS API error:', response.status, errorBody)
            return NextResponse.json({ error: 'TTS synthesis failed' }, { status: response.status })
        }

        const data = await response.json()
        const audioContent = data.audioContent // base64 encoded MP3

        // Convert base64 to binary
        const binaryString = atob(audioContent)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        const buffer = bytes.buffer

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
        console.error('[v0] TTS route error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
