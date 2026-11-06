import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DICTATION_ERROR_MESSAGE,
  DICTATION_PERMISSION_MESSAGE,
  DICTATION_RECORDING_LABEL,
  DICTATION_UNSUPPORTED_MESSAGE,
  appendDictatedText,
  collectFinalTranscript,
  collectInterimTranscript,
  dictationErrorMessage,
  dictationUnavailableMessage,
  getSpeechRecognitionCtor,
  isDictationSupported,
  isGetUserMediaSupported,
  isMediaRecorderSupported,
  isSpeechRecognitionSupported,
  isUnsafeSpeechRecognitionPlatform,
  preferRecorderMimeType,
  recordingFileName,
  shouldSendOnEnterKey,
  shouldUseMediaRecorderDictation,
} from './speech-dictation.ts'
import { insertTextAtCursor, MESSAGE_COMPOSER_EMOJIS } from './message-composer-emojis.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('speech dictation helpers', () => {
  it('detects SpeechRecognition and the webkit prefix', () => {
    assert.equal(isSpeechRecognitionSupported({}), false)
    assert.equal(getSpeechRecognitionCtor({}), null)

    class Fake {}
    assert.equal(getSpeechRecognitionCtor({ SpeechRecognition: Fake }), Fake)
    assert.equal(getSpeechRecognitionCtor({ webkitSpeechRecognition: Fake }), Fake)
    assert.equal(isSpeechRecognitionSupported({ webkitSpeechRecognition: Fake }), true)
  })

  it('treats iPhone, iPad, and iPadOS desktop-UA as unsafe for Web Speech even when the ctor exists', () => {
    class Fake {}
    class FakeRecorder {}
    const iPhone = {
      webkitSpeechRecognition: Fake,
      MediaRecorder: FakeRecorder,
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        mediaDevices: { getUserMedia: async () => ({}) },
      },
    }
    assert.equal(isUnsafeSpeechRecognitionPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true)
    assert.equal(isUnsafeSpeechRecognitionPlatform({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }), true)
    assert.equal(isUnsafeSpeechRecognitionPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true)
    assert.equal(isUnsafeSpeechRecognitionPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120' }), false)
    assert.equal(isSpeechRecognitionSupported(iPhone), false)
    assert.equal(isGetUserMediaSupported(iPhone), true)
    assert.equal(isMediaRecorderSupported(iPhone), true)
    assert.equal(shouldUseMediaRecorderDictation(iPhone), true)
    assert.equal(isDictationSupported(iPhone), true)
    assert.equal(
      shouldUseMediaRecorderDictation({
        navigator: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
          mediaDevices: { getUserMedia: async () => ({}) },
        },
      }),
      true,
    )
    assert.equal(dictationUnavailableMessage(), DICTATION_UNSUPPORTED_MESSAGE)
  })

  it('prefers mp4 recordings on iOS-like mime support and names the file .m4a', () => {
    assert.equal(preferRecorderMimeType((type) => type === 'audio/mp4' || type.startsWith('audio/webm')), 'audio/mp4')
    assert.equal(preferRecorderMimeType((type) => type.startsWith('audio/webm')), 'audio/webm;codecs=opus')
    assert.equal(recordingFileName('audio/mp4'), 'dictation.m4a')
    assert.equal(recordingFileName('audio/webm;codecs=opus'), 'dictation.webm')
  })

  it('appends dictated text without auto-spacing twice', () => {
    assert.equal(appendDictatedText('', ' Hello '), 'Hello')
    assert.equal(appendDictatedText('See you', 'Thursday'), 'See you Thursday')
    assert.equal(appendDictatedText('See you ', 'Thursday'), 'See you Thursday')
  })

  it('collects only final transcripts from a recognition event', () => {
    const text = collectFinalTranscript({
      resultIndex: 0,
      results: [
        { isFinal: false, 0: { transcript: 'hold' } },
        { isFinal: true, 0: { transcript: 'See you' } },
        { isFinal: true, 0: { transcript: 'Thursday' } },
      ],
    })
    assert.equal(text, 'See you Thursday')
  })

  it('collects interim transcripts for live composer text', () => {
    const text = collectInterimTranscript({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: 'See you' } },
        { isFinal: false, 0: { transcript: 'Thursday' } },
      ],
    })
    assert.equal(text, 'Thursday')
  })

  it('maps permission vs generic dictation errors and skips no-speech', () => {
    assert.equal(dictationErrorMessage('not-allowed'), DICTATION_PERMISSION_MESSAGE)
    assert.equal(dictationErrorMessage('service-not-allowed'), DICTATION_PERMISSION_MESSAGE)
    assert.equal(dictationErrorMessage('network'), DICTATION_ERROR_MESSAGE)
    assert.equal(dictationErrorMessage('no-speech'), '')
    assert.match(DICTATION_UNSUPPORTED_MESSAGE, /not supported/i)
  })

  it('sends on Enter only on desktop without Shift', () => {
    assert.equal(shouldSendOnEnterKey('Enter', false, true), true)
    assert.equal(shouldSendOnEnterKey('Enter', true, true), false)
    assert.equal(shouldSendOnEnterKey('Enter', false, false), false)
    assert.equal(shouldSendOnEnterKey('a', false, true), false)
  })
})

describe('composer emoji insert', () => {
  it('keeps a palette that includes pray and heart', () => {
    assert.ok(MESSAGE_COMPOSER_EMOJIS.includes('🙏'))
    assert.ok(MESSAGE_COMPOSER_EMOJIS.includes('❤️'))
  })

  it('inserts at the cursor instead of always appending', () => {
    const result = insertTextAtCursor('See  Thursday', 'you', 4, 4)
    assert.equal(result.next, 'See you Thursday')
    assert.equal(result.cursor, 7)
  })
})

describe('composer and mobile chrome wiring', () => {
  it('keeps paperclip, send, emoji, mic, and the 5 / 10 MB caps', () => {
    const composer = readFileSync(join(here, '../components/messages/message-composer.tsx'), 'utf8')
    const limits = readFileSync(join(here, './message-limits.ts'), 'utf8')
    assert.match(composer, /Paperclip/)
    assert.match(composer, /message-send/)
    assert.match(composer, /message-emoji-picker/)
    assert.match(composer, /message-mic/)
    const hook = readFileSync(join(here, '../hooks/use-speech-dictation.ts'), 'utf8')
    const route = readFileSync(join(here, '../app/api/messages/transcribe/route.ts'), 'utf8')
    const tokenRoute = readFileSync(join(here, '../app/api/messages/scribe-token/route.ts'), 'utf8')
    const layout = readFileSync(join(here, '../app/layout.tsx'), 'utf8')
    assert.match(hook, /dictationUnavailableMessage/)
    assert.match(hook, /isSpeechRecognitionSupported\(\)/)
    assert.match(hook, /shouldUseMediaRecorderDictation\(\)/)
    assert.match(hook, /recognition\.continuous = false/)
    assert.match(hook, /interimResults = true/)
    assert.match(hook, /Never restart/)
    assert.match(hook, /Never pass a timeslice/)
    assert.match(hook, /DICTATION_WATCHDOG_MS/)
    assert.match(hook, /DICTATION_RECORDING_MAX_MS/)
    assert.match(hook, /\/api\/messages\/transcribe/)
    assert.match(hook, /SCRIBE_TOKEN_PATH/)
    assert.match(hook, /buildScribeRealtimeUrl/)
    assert.match(hook, /encodeWavFromPcm16/)
    assert.doesNotMatch(hook, /new MediaRecorder/)
    assert.doesNotMatch(hook, /continuous = true/)
    assert.match(hook, /position: 'top-center'/)
    assert.match(composer, /DICTATION_RECORDING_LABEL/)
    assert.match(composer, /dictation-transcribing/)
    assert.match(composer, /dictation-volume/)
    assert.match(composer, /applySessionDictation/)
    assert.match(composer, /bg-emerald-500/)
    assert.match(composer, /max-md:pr-12/)
    assert.match(composer, /rounded-full/)
    assert.match(composer, /message-send-mobile/)
    assert.match(composer, /hidden h-11 w-11 shrink-0 rounded-xl/)
    assert.match(composer, /max-md:pb-\[max\(1\.75rem,calc\(env\(safe-area-inset-bottom\)\+1\.25rem\)\)\]/)
    assert.match(route, /ELEVENLABS_API_KEY/)
    assert.match(tokenRoute, /realtime_scribe/)
    assert.match(tokenRoute, /tokens\.singleUse\.create/)
    assert.match(layout, /viewportFit: 'cover'/)
    assert.match(DICTATION_RECORDING_LABEL, /Recording/)
    assert.match(limits, /MAX_MESSAGE_ATTACHMENTS = 5/)
    assert.match(limits, /10 \* 1024 \* 1024/)
  })

  it('hides the main nav on mobile only while a conversation is open', () => {
    const chrome = readFileSync(
      join(here, '../components/messages/mobile-conversation-chrome.tsx'),
      'utf8',
    )
    const view = readFileSync(join(here, '../components/messages/messages-view.tsx'), 'utf8')
    const conversation = readFileSync(
      join(here, '../components/messages/messages-conversation.tsx'),
      'utf8',
    )
    const layout = readFileSync(join(here, '../app/dashboard/layout.tsx'), 'utf8')
    assert.match(chrome, /max-md:hidden/)
    assert.match(view, /messages-inbox/)
    assert.match(view, /setMobileThreadOpen\(false\)/)
    assert.match(conversation, /max-md:fixed max-md:inset-0/)
    assert.match(conversation, /max-md:rounded-none max-md:border-0/)
    assert.match(layout, /MobileConversationChromeProvider/)
    assert.match(layout, /MobileAwareDashboardHeader/)
  })
})
