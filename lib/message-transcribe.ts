import {
  DICTATION_EMPTY_AUDIO_MESSAGE,
  DICTATION_STT_ERROR_MESSAGE,
  DICTATION_STT_UNAVAILABLE_MESSAGE,
  DICTATION_STT_UNCONFIGURED_MESSAGE,
} from './speech-dictation.ts'

/** Same key already used by /api/tts-elevenlabs. */
export const ELEVENLABS_API_KEY_ENV = 'ELEVENLABS_API_KEY'
export const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text'
export const ELEVENLABS_STT_MODEL = 'scribe_v2'
export const TRANSCRIBE_MAX_BYTES = 4 * 1024 * 1024
export const TRANSCRIBE_MIN_BYTES = 64
export const STT_UNAVAILABLE_CODE = 'stt_unavailable'
export const SCRIBE_FAILED_CODE = 'scribe_failed'
export const TOKEN_FAILED_CODE = 'token_failed'

export type ScribeClientFailureCode =
  | typeof STT_UNAVAILABLE_CODE
  | typeof SCRIBE_FAILED_CODE
  | typeof TOKEN_FAILED_CODE

export type ScribeClientFailure = {
  code: ScribeClientFailureCode
  error: string
  httpStatus: number
}

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
  if (code === STT_UNAVAILABLE_CODE) return DICTATION_STT_UNAVAILABLE_MESSAGE
  if (status === 503 || code === 'unconfigured') return DICTATION_STT_UNCONFIGURED_MESSAGE
  if (status === 401 || code === 'unauthorized') return 'Sign in to use voice dictation.'
  return DICTATION_STT_ERROR_MESSAGE
}

export function summarizeScribeErrorBody(body: string): string {
  const trimmed = body.replace(/\s+/g, ' ').trim().slice(0, 400)
  return trimmed
}

/**
 * ElevenLabs 401/403 (invalid key or missing speech_to_text) is an ops/config
 * problem, not a bad recording. Map it away from user-auth 401 so the client
 * never says "sign in" or "unsupported browser".
 */
export function isElevenLabsSttPermissionFailure(status: number, detail?: string): boolean {
  if (status === 401 || status === 403) return true
  const text = (detail || '').toLowerCase()
  return text.includes('missing_permissions') || text.includes('missing the permission')
}

export function mapElevenLabsSttFailure(
  status: number,
  detail?: string,
  kind: 'transcribe' | 'token' = 'transcribe',
): ScribeClientFailure {
  if (isElevenLabsSttPermissionFailure(status, detail)) {
    return {
      code: STT_UNAVAILABLE_CODE,
      error: DICTATION_STT_UNAVAILABLE_MESSAGE,
      httpStatus: 503,
    }
  }
  if (kind === 'token') {
    return {
      code: TOKEN_FAILED_CODE,
      error: DICTATION_STT_ERROR_MESSAGE,
      httpStatus: 502,
    }
  }
  return {
    code: SCRIBE_FAILED_CODE,
    error: DICTATION_STT_ERROR_MESSAGE,
    httpStatus: status >= 400 && status < 500 ? 422 : 502,
  }
}

export function elevenLabsErrorMeta(error: unknown): { status: number; detail: string } {
  if (!error || typeof error !== 'object') return { status: 502, detail: '' }
  const e = error as {
    statusCode?: unknown
    status?: unknown
    body?: unknown
    message?: unknown
  }
  let status = 502
  if (typeof e.statusCode === 'number') status = e.statusCode
  else if (typeof e.status === 'number') status = e.status
  else if (typeof e.message === 'string') {
    const match = e.message.match(/status code:\s*(\d+)/i)
    if (match) status = Number(match[1])
  }
  const raw =
    typeof e.body === 'string'
      ? e.body
      : e.body != null
        ? JSON.stringify(e.body)
        : typeof e.message === 'string'
          ? e.message
          : ''
  return { status, detail: summarizeScribeErrorBody(raw) }
}

/** Token mint already proved the key cannot do STT — skip a doomed WAV POST. */
export function shouldSkipWavFallback(code?: string): boolean {
  return code === 'unconfigured' || code === STT_UNAVAILABLE_CODE || code === 'unauthorized'
}

export async function transcribeAudioWithElevenLabs(options: {
  apiKey: string
  file: Blob
  filename: string
  language?: string
  fetchImpl?: typeof fetch
}): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string; detail?: string }> {
  const type = options.file.type || (options.filename.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream')
  const file =
    typeof File !== 'undefined'
      ? new File([options.file], options.filename, { type })
      : options.file

  const form = new FormData()
  form.append('file', file, options.filename)
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
    const detail = summarizeScribeErrorBody(await response.text().catch(() => ''))
    return { ok: false, status: response.status, error: DICTATION_STT_ERROR_MESSAGE, detail }
  }

  const payload = await response.json()
  return { ok: true, text: parseScribeTranscript(payload) }
}
