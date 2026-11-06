import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ELEVENLABS_API_KEY_ENV,
  mapElevenLabsSttFailure,
  transcribeAudioWithElevenLabs,
  transcribeErrorMessage,
  validateTranscribeFile,
} from '@/lib/message-transcribe'
import { languageCodeForScribe } from '@/lib/scribe-realtime'
import { DICTATION_EMPTY_AUDIO_MESSAGE, DICTATION_STT_UNCONFIGURED_MESSAGE } from '@/lib/speech-dictation'

export const maxDuration = 30

/**
 * Fallback STT for the iOS PCM path (and any client that posts audio/wav).
 * Live dictation prefers Scribe Realtime; this route transcribes a WAV when
 * the websocket did not return text.
 *
 * Env: ELEVENLABS_API_KEY (already used by /api/tts-elevenlabs).
 */
export async function POST(request: NextRequest) {
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

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
    }

    const invalid = validateTranscribeFile(file)
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 })
    }

    const filename =
      typeof file === 'object' && 'name' in file && typeof file.name === 'string' && file.name
        ? file.name
        : 'dictation.wav'
    const languageRaw = typeof form.get('language') === 'string' ? String(form.get('language')) : undefined
    const languageCode = languageCodeForScribe(languageRaw)

    const result = await transcribeAudioWithElevenLabs({
      apiKey,
      file,
      filename,
      language: languageCode,
    })

    if (!result.ok) {
      const mapped = mapElevenLabsSttFailure(result.status, result.detail)
      console.error('[messages/transcribe] ElevenLabs rejected audio', {
        status: result.status,
        filename,
        type: file.type,
        size: file.size,
        code: mapped.code,
        detail: result.detail,
      })
      return NextResponse.json({ error: mapped.error, code: mapped.code }, { status: mapped.httpStatus })
    }

    if (!result.text) {
      return NextResponse.json({ error: DICTATION_EMPTY_AUDIO_MESSAGE, text: '' }, { status: 422 })
    }

    return NextResponse.json({ text: result.text })
  } catch (error) {
    console.error('[messages/transcribe]', error)
    return NextResponse.json({ error: transcribeErrorMessage(500) }, { status: 500 })
  }
}
