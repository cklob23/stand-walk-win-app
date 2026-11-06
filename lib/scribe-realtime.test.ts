import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SCRIBE_REALTIME_MODEL,
  SCRIBE_REALTIME_URL,
  SCRIBE_TOKEN_PATH,
  applySessionDictation,
  buildScribeRealtimeUrl,
  joinLiveDictation,
  languageCodeForScribe,
  parseScribeRealtimeEvent,
  scribeAudioChunkMessage,
  transcribeFileFromPcmWav,
} from './scribe-realtime.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('scribe realtime helpers', () => {
  it('builds a token-authenticated PCM16 websocket URL', () => {
    const url = buildScribeRealtimeUrl('tok_123', 'en-US')
    assert.match(url, new RegExp(`^${SCRIBE_REALTIME_URL}\\?`))
    assert.match(url, /model_id=scribe_v2_realtime/)
    assert.match(url, /token=tok_123/)
    assert.match(url, /audio_format=pcm_16000/)
    assert.match(url, /commit_strategy=vad/)
    assert.match(url, /language_code=en/)
    assert.equal(SCRIBE_REALTIME_MODEL, 'scribe_v2_realtime')
    assert.equal(SCRIBE_TOKEN_PATH, '/api/messages/scribe-token')
  })

  it('strips BCP-47 region codes so Scribe gets ISO 639', () => {
    assert.equal(languageCodeForScribe('en-US'), 'en')
    assert.equal(languageCodeForScribe('pt_BR'), 'pt')
    assert.equal(languageCodeForScribe(''), undefined)
    assert.equal(languageCodeForScribe('!!'), undefined)
  })

  it('joins committed and partial transcripts the way iMessage overlays live text', () => {
    assert.equal(joinLiveDictation('', 'See you'), 'See you')
    assert.equal(joinLiveDictation('See you', 'Thursday'), 'See you Thursday')
    assert.equal(applySessionDictation('', 'See you Thursday'), 'See you Thursday')
    assert.equal(applySessionDictation('Hi', 'See you'), 'Hi See you')
    assert.equal(applySessionDictation('Hi ', 'See you'), 'Hi See you')
  })

  it('parses partial and committed websocket events', () => {
    assert.deepEqual(parseScribeRealtimeEvent({ message_type: 'partial_transcript', text: ' See ' }), {
      type: 'partial_transcript',
      text: 'See',
    })
    assert.deepEqual(parseScribeRealtimeEvent({ message_type: 'committed_transcript', transcript: 'Thursday' }), {
      type: 'committed_transcript',
      text: 'Thursday',
    })
    assert.equal(parseScribeRealtimeEvent({ text: 'nope' }), null)
  })

  it('serializes PCM chunks and wraps WAV files for the POST fallback', () => {
    const message = JSON.parse(scribeAudioChunkMessage('abc', { commit: true }))
    assert.equal(message.message_type, 'input_audio_chunk')
    assert.equal(message.audio_base_64, 'abc')
    assert.equal(message.commit, true)
    assert.equal(message.sample_rate, 16_000)
    const file = transcribeFileFromPcmWav(new Blob(['RIFF'], { type: 'audio/wav' }))
    assert.equal(file.name, 'dictation.wav')
    assert.equal(file.type, 'audio/wav')
  })

  it('keeps the API key on the token route and PCM on the client hook', () => {
    const tokenRoute = readFileSync(join(here, '../app/api/messages/scribe-token/route.ts'), 'utf8')
    const hook = readFileSync(join(here, '../hooks/use-speech-dictation.ts'), 'utf8')
    assert.match(tokenRoute, /ELEVENLABS_API_KEY/)
    assert.match(tokenRoute, /createClient/)
    assert.doesNotMatch(hook, /ELEVENLABS_API_KEY/)
    assert.doesNotMatch(hook, /xi-api-key/)
  })
})
