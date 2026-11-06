import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ELEVENLABS_API_KEY_ENV,
  transcribeAudioWithElevenLabs,
  transcribeErrorMessage,
  validateTranscribeFile,
} from '@/lib/message-transcribe'
import { DICTATION_EMPTY_AUDIO_MESSAGE, DICTATION_STT_UNCONFIGURED_MESSAGE } from '@/lib/speech-dictation'

export const maxDuration = 30

/**
 * iOS Safari/PWA cannot safely use Web Speech, so Messages records with
 * MediaRecorder and transcribes here.
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

    const filename = typeof file === 'object' && 'name' in file && typeof file.name === 'string' && file.name
      ? file.name
      : 'dictation.m4a'
    const language = typeof form.get('language') === 'string' ? String(form.get('language')) : undefined

    const result = await transcribeAudioWithElevenLabs({
      apiKey,
      file,
      filename,
      language,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status >= 400 ? result.status : 502 })
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
