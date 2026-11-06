import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PCM_TARGET_RATE,
  concatInt16,
  dictationMeterLevels,
  downsampleToRate,
  encodeWavFromPcm16,
  floatToPcm16,
  pcm16ToBase64,
  rmsLevel,
} from './pcm-audio.ts'

describe('pcm audio helpers', () => {
  it('computes a bounded RMS level', () => {
    assert.equal(rmsLevel([]), 0)
    assert.ok(rmsLevel(new Float32Array([0, 0, 0])) < 0.01)
    assert.ok(rmsLevel(new Float32Array([1, -1, 1, -1])) > 0.9)
    assert.equal(rmsLevel(new Float32Array([1, 1, 1, 1])), 1)
  })

  it('downsamples 48k audio to 16k by averaging windows', () => {
    const input = new Float32Array(12)
    for (let i = 0; i < 12; i++) input[i] = i
    const out = downsampleToRate(input, 48_000, 16_000)
    assert.equal(out.length, 4)
    assert.equal(downsampleToRate(input, 16_000, 16_000), input)
  })

  it('encodes PCM16 WAV that Scribe can name as audio/wav', () => {
    const pcm = floatToPcm16(new Float32Array([0, 0.5, -0.5, 1]))
    assert.equal(pcm.length, 4)
    assert.ok(pcm[1] > 0)
    assert.ok(pcm[2] < 0)
    const wav = encodeWavFromPcm16(pcm, PCM_TARGET_RATE)
    assert.equal(wav.type, 'audio/wav')
    assert.equal(wav.size, 44 + 8)
  })

  it('concatenates PCM chunks and base64-encodes them for the websocket', () => {
    const joined = concatInt16([new Int16Array([1, 2]), new Int16Array([3])])
    assert.deepEqual(Array.from(joined), [1, 2, 3])
    const encoded = pcm16ToBase64(new Int16Array([1, 2, 3, 4]))
    assert.equal(typeof encoded, 'string')
    assert.ok(encoded.length > 0)
  })

  it('maps volume to green meter bar fill amounts', () => {
    const idle = dictationMeterLevels(0)
    assert.equal(idle.length, 5)
    assert.ok(idle.every((level) => level === 0))
    const loud = dictationMeterLevels(1)
    assert.ok(loud.every((level) => level === 1))
    const mid = dictationMeterLevels(0.4)
    assert.ok(mid[0] > mid[4])
  })
})
