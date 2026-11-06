import { NextResponse } from 'next/server'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createClient } from '@/lib/supabase/server'
import { ELEVENLABS_API_KEY_ENV, transcribeErrorMessage } from '@/lib/message-transcribe'
import { DICTATION_STT_UNCONFIGURED_MESSAGE } from '@/lib/speech-dictation'

/**
 * Single-use Scribe Realtime token so the browser can stream PCM without
 * seeing ELEVENLABS_API_KEY. Same key as /api/tts-elevenlabs.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: transcribeErrorMessage(401), code: 'unauthorized' }, { status: 401 })
    }

    const apiKey = process.env[ELEVENLABS_API_KEY_ENV]
    if (!apiKey) {
      return NextResponse.json(
        { error: DICTATION_STT_UNCONFIGURED_MESSAGE, code: 'unconfigured' },
        { status: 503 },
      )
    }

    const client = new ElevenLabsClient({ apiKey })
    const created = await client.tokens.singleUse.create('realtime_scribe')
    const token = created?.token
    if (!token) {
      return NextResponse.json({ error: transcribeErrorMessage(502), code: 'token_failed' }, { status: 502 })
    }
    return NextResponse.json({ token })
  } catch (error) {
    console.error('[messages/scribe-token]', error)
    return NextResponse.json({ error: transcribeErrorMessage(502), code: 'token_failed' }, { status: 502 })
  }
}
