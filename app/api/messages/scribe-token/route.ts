import { NextResponse } from 'next/server'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createClient } from '@/lib/supabase/server'
import {
  ELEVENLABS_API_KEY_ENV,
  TOKEN_FAILED_CODE,
  elevenLabsErrorMeta,
  mapElevenLabsSttFailure,
  transcribeErrorMessage,
} from '@/lib/message-transcribe'
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
      return NextResponse.json({ error: transcribeErrorMessage(502), code: TOKEN_FAILED_CODE }, { status: 502 })
    }
    return NextResponse.json({ token })
  } catch (error) {
    const meta = elevenLabsErrorMeta(error)
    const mapped = mapElevenLabsSttFailure(meta.status, meta.detail, 'token')
    console.error('[messages/scribe-token]', { status: meta.status, code: mapped.code, detail: meta.detail, error })
    return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.httpStatus })
  }
}
