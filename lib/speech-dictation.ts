export const DICTATION_UNSUPPORTED_MESSAGE =
  'Voice dictation is not supported in this browser'
export const DICTATION_UNSAFE_MESSAGE =
  "Voice dictation isn't available in this browser. Type your message instead."
export const DICTATION_PERMISSION_MESSAGE =
  'Microphone permission is needed to dictate a message'
export const DICTATION_ERROR_MESSAGE = 'Could not capture audio. Try again.'
export const DICTATION_LISTENING_LABEL = 'Listening… tap the mic to stop'
export const DICTATION_WATCHDOG_MS = 12_000

export interface DictationAlternative {
  transcript: string
}

export interface DictationResult {
  isFinal: boolean
  0: DictationAlternative
}

export interface DictationResultEvent {
  resultIndex: number
  results: ArrayLike<DictationResult>
}

export interface DictationRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: DictationResultEvent) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

export type DictationRecognitionCtor = new () => DictationRecognition

export interface SpeechNavigatorHints {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
}

/**
 * iOS / iPadOS expose webkitSpeechRecognition but starting a session
 * (especially continuous + onend restart) can freeze Safari and PWAs.
 */
export function isUnsafeSpeechRecognitionPlatform(hints: SpeechNavigatorHints = {}): boolean {
  const ua = hints.userAgent || ''
  const platform = hints.platform || ''
  const maxTouchPoints = hints.maxTouchPoints ?? 0
  if (/iPhone|iPod|iPad/i.test(ua)) return true
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return true
  if (platform === 'iPhone' || platform === 'iPad' || platform === 'iPod') return true
  return false
}

function readNavigatorHints(globalObj: object): SpeechNavigatorHints {
  const g = globalObj as { navigator?: SpeechNavigatorHints }
  if (g.navigator) {
    return {
      userAgent: g.navigator.userAgent,
      platform: g.navigator.platform,
      maxTouchPoints: g.navigator.maxTouchPoints,
    }
  }
  if (globalObj === globalThis && typeof navigator !== 'undefined') {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    }
  }
  return {}
}

export function getSpeechRecognitionCtor(
  globalObj: object = globalThis,
): DictationRecognitionCtor | null {
  const g = globalObj as Record<string, unknown>
  const ctor = g.SpeechRecognition || g.webkitSpeechRecognition
  return typeof ctor === 'function' ? (ctor as DictationRecognitionCtor) : null
}

export function isSpeechRecognitionSupported(globalObj: object = globalThis): boolean {
  if (!getSpeechRecognitionCtor(globalObj)) return false
  return !isUnsafeSpeechRecognitionPlatform(readNavigatorHints(globalObj))
}

export function dictationUnavailableMessage(globalObj: object = globalThis): string {
  if (isUnsafeSpeechRecognitionPlatform(readNavigatorHints(globalObj))) {
    return DICTATION_UNSAFE_MESSAGE
  }
  return DICTATION_UNSUPPORTED_MESSAGE
}

export function appendDictatedText(current: string, transcript: string): string {
  const piece = transcript.replace(/\s+/g, ' ').trim()
  if (!piece) return current
  if (!current.trim()) return piece
  return /[\s\n]$/.test(current) ? `${current}${piece}` : `${current} ${piece}`
}

export function collectFinalTranscript(event: DictationResultEvent): string {
  const parts: string[] = []
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i]
    if (result?.isFinal && result[0]?.transcript) {
      parts.push(result[0].transcript)
    }
  }
  return parts.join(' ')
}

export function dictationErrorMessage(error: string | undefined): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return DICTATION_PERMISSION_MESSAGE
  }
  if (error === 'no-speech') return ''
  return DICTATION_ERROR_MESSAGE
}

export function shouldSendOnEnterKey(
  key: string,
  shiftKey: boolean,
  isDesktop: boolean,
): boolean {
  return isDesktop && key === 'Enter' && !shiftKey
}
