import { PCM_TARGET_RATE } from './pcm-audio.ts'

export const SCRIBE_REALTIME_MODEL = 'scribe_v2_realtime'
export const SCRIBE_REALTIME_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime'
export const SCRIBE_TOKEN_PATH = '/api/messages/scribe-token'

export function buildScribeRealtimeUrl(token: string, language?: string): string {
  const params = new URLSearchParams({
    model_id: SCRIBE_REALTIME_MODEL,
    token,
    audio_format: `pcm_${PCM_TARGET_RATE}`,
    commit_strategy: 'vad',
  })
  const languageCode = languageCodeForScribe(language)
  if (languageCode) params.set('language_code', languageCode)
  return `${SCRIBE_REALTIME_URL}?${params.toString()}`
}

export function scribeAudioChunkMessage(
  audioBase64: string,
  opts: { commit?: boolean } = {},
): string {
  return JSON.stringify({
    message_type: 'input_audio_chunk',
    audio_base_64: audioBase64,
    commit: Boolean(opts.commit),
    sample_rate: PCM_TARGET_RATE,
  })
}

export function scribeTranscriptText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const data = payload as { text?: unknown; transcript?: unknown }
  const raw = typeof data.text === 'string' ? data.text : typeof data.transcript === 'string' ? data.transcript : ''
  return raw.replace(/\s+/g, ' ').trim()
}

export function joinLiveDictation(committed: string, partial: string): string {
  const a = committed.replace(/\s+/g, ' ').trim()
  const b = partial.replace(/\s+/g, ' ').trim()
  if (!a) return b
  if (!b) return a
  return `${a} ${b}`
}

export function applySessionDictation(base: string, sessionText: string): string {
  const live = sessionText.replace(/\s+/g, ' ').trim()
  if (!base.trim()) return live
  if (!live) return base
  return /[\s\n]$/.test(base) ? `${base}${live}` : `${base} ${live}`
}

export function parseScribeRealtimeEvent(payload: unknown): { type: string; text: string } | null {
  if (!payload || typeof payload !== 'object') return null
  const type = (payload as { message_type?: unknown }).message_type
  if (typeof type !== 'string') return null
  return { type, text: scribeTranscriptText(payload) }
}

export function languageCodeForScribe(lang?: string): string | undefined {
  if (!lang) return undefined
  const primary = lang.trim().toLowerCase().split(/[-_]/)[0]
  if (!/^[a-z]{2,3}$/.test(primary)) return undefined
  return primary
}

export function transcribeFileFromPcmWav(wav: Blob): File {
  return new File([wav], 'dictation.wav', { type: 'audio/wav' })
}
