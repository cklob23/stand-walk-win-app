import {
  DICTATION_EMPTY_AUDIO_MESSAGE,
  DICTATION_STT_ERROR_MESSAGE,
  DICTATION_STT_UNCONFIGURED_MESSAGE,
} from './speech-dictation.ts'

/** Same key already used by /api/tts-elevenlabs. */
export const ELEVENLABS_API_KEY_ENV = 'ELEVENLABS_API_KEY'
export const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text'
export const ELEVENLABS_STT_MODEL = 'scribe_v2'
export const TRANSCRIBE_MAX_BYTES = 4 * 1024 * 1024
export const TRANSCRIBE_MIN_BYTES = 64

export function validateTranscribeFile(file: { size: number } | null | undefined): string | null {
  if (!file) return 'No audio provided'
  if (file.size < TRANSCRIBE_MIN_BYTES) return DICTATION_EMPTY_AUDIO_MESSAGE
  if (file.size > TRANSCRIBE_MAX_BYTES) return 'Recording is too large. Try a shorter clip.'
  return null
}

export function parseScribeTranscript(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const text = (payload as { text?: unknown }).text
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

export function transcribeErrorMessage(status: number, code?: string): string {
  if (status === 503 || code === 'unconfigured') return DICTATION_STT_UNCONFIGURED_MESSAGE
  if (status === 401) return 'Sign in to use voice dictation.'
  return DICTATION_STT_ERROR_MESSAGE
}

export async function transcribeAudioWithElevenLabs(options: {
  apiKey: string
  file: Blob
  filename: string
  language?: string
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const form = new FormData()
  form.append('file', options.file, options.filename)
  form.append('model_id', ELEVENLABS_STT_MODEL)
  form.append('tag_audio_events', 'false')
  if (options.language) form.append('language_code', options.language)

  const fetchImpl = options.fetchImpl || fetch
  const response = await fetchImpl(ELEVENLABS_STT_URL, {
    method: 'POST',
    headers: { 'xi-api-key': options.apiKey },
    body: form,
  })

  if (!response.ok) {
    return { ok: false, status: response.status, error: DICTATION_STT_ERROR_MESSAGE }
  }

  const payload = await response.json()
  return { ok: true, text: parseScribeTranscript(payload) }
}
