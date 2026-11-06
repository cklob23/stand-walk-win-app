import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DICTATION_EMPTY_AUDIO_MESSAGE,
  DICTATION_STT_ERROR_MESSAGE,
  DICTATION_STT_UNCONFIGURED_MESSAGE,
} from './speech-dictation.ts'
import {
  ELEVENLABS_API_KEY_ENV,
  ELEVENLABS_STT_MODEL,
  ELEVENLABS_STT_URL,
  parseScribeTranscript,
  summarizeScribeErrorBody,
  transcribeAudioWithElevenLabs,
  transcribeErrorMessage,
  validateTranscribeFile,
} from './message-transcribe.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('message transcribe helpers', () => {
  it('rejects empty or oversized recordings', () => {
    assert.equal(validateTranscribeFile(null), 'No audio provided')
    assert.equal(validateTranscribeFile({ size: 8 }), DICTATION_EMPTY_AUDIO_MESSAGE)
    assert.ok(validateTranscribeFile({ size: 9 * 1024 * 1024 }))
    assert.equal(validateTranscribeFile({ size: 2048 }), null)
  })

  it('parses ElevenLabs Scribe text and ignores missing payloads', () => {
    assert.equal(parseScribeTranscript({ text: '  See you Thursday  ' }), 'See you Thursday')
    assert.equal(parseScribeTranscript({ text: 12 }), '')
    assert.equal(parseScribeTranscript(null), '')
  })

  it('maps HTTP failures to non-blocking copy', () => {
    assert.equal(transcribeErrorMessage(503, 'unconfigured'), DICTATION_STT_UNCONFIGURED_MESSAGE)
    assert.equal(transcribeErrorMessage(401), 'Sign in to use voice dictation.')
    assert.equal(transcribeErrorMessage(502), DICTATION_STT_ERROR_MESSAGE)
  })

  it('posts the audio file to ElevenLabs Scribe with the shared API key header', async () => {
    const calls: Array<{ url: string; headers: HeadersInit | undefined; hasFile: boolean }> = []
    const result = await transcribeAudioWithElevenLabs({
      apiKey: 'test-key',
      file: new Blob(['abcdabcd'], { type: 'audio/mp4' }),
      filename: 'dictation.m4a',
      fetchImpl: async (url, init) => {
        const body = init?.body as FormData
        calls.push({
          url: String(url),
          headers: init?.headers,
          hasFile: body instanceof FormData && body.get('file') != null && body.get('model_id') === ELEVENLABS_STT_MODEL,
        })
        return new Response(JSON.stringify({ text: 'See you Thursday' }), { status: 200 })
      },
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.text, 'See you Thursday')
    assert.equal(calls[0]?.url, ELEVENLABS_STT_URL)
    assert.equal((calls[0]?.headers as Record<string, string>)['xi-api-key'], 'test-key')
    assert.equal(calls[0]?.hasFile, true)
  })

  it('keeps ElevenLabs error bodies for server logs without showing them in the toast', () => {
    assert.equal(summarizeScribeErrorBody('  invalid_file_format  '), 'invalid_file_format')
    assert.equal(summarizeScribeErrorBody('x'.repeat(500)).length, 400)
  })

  it('returns scribe failure details instead of swallowing the ElevenLabs body', async () => {
    const result = await transcribeAudioWithElevenLabs({
      apiKey: 'test-key',
      file: new Blob(['abcdabcd'], { type: 'audio/mp4' }),
      filename: 'dictation.m4a',
      fetchImpl: async () => new Response('{"detail":"invalid_content"}', { status: 400 }),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 400)
      assert.equal(result.error, DICTATION_STT_ERROR_MESSAGE)
      assert.match(result.detail || '', /invalid_content/)
    }
  })

  it('documents ELEVENLABS_API_KEY on the messages transcribe route', () => {
    const route = readFileSync(join(here, '../app/api/messages/transcribe/route.ts'), 'utf8')
    const tokenRoute = readFileSync(join(here, '../app/api/messages/scribe-token/route.ts'), 'utf8')
    const hook = readFileSync(join(here, '../hooks/use-speech-dictation.ts'), 'utf8')
    assert.equal(ELEVENLABS_API_KEY_ENV, 'ELEVENLABS_API_KEY')
    assert.match(route, /ELEVENLABS_API_KEY/)
    assert.match(route, /createClient/)
    assert.match(route, /scribe_failed/)
    assert.match(tokenRoute, /realtime_scribe/)
    assert.doesNotMatch(hook, /webkitSpeechRecognition\(\)/)
    assert.match(hook, /Hard rule: never construct\/start Web Speech on iOS/)
  })
})
