export const PCM_TARGET_RATE = 16_000

export function rmsLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    sum += v * v
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3)
}

export function downsampleToRate(
  input: Float32Array,
  inputRate: number,
  outputRate: number = PCM_TARGET_RATE,
): Float32Array {
  if (!input.length) return new Float32Array(0)
  if (inputRate <= 0 || outputRate <= 0) return input
  if (Math.abs(inputRate - outputRate) < 1) return input
  const ratio = inputRate / outputRate
  const outLength = Math.max(1, Math.floor(input.length / ratio))
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    let count = 0
    for (let j = start; j < end; j++) {
      sum += input[j]
      count++
    }
    output[i] = count ? sum / count : input[start] || 0
  }
  return output
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return output
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
}

export function encodeWavFromPcm16(pcm: Int16Array, sampleRate: number = PCM_TARGET_RATE): Blob {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const dataSize = pcm.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    view.setInt16(offset, pcm[i], true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export function dictationMeterLevels(volume: number, bars = 5): number[] {
  const level = Math.max(0, Math.min(1, volume))
  return Array.from({ length: bars }, (_, i) => {
    const peak = (i + 1) / bars
    return Math.max(0, Math.min(1, level / peak))
  })
}

export function concatInt16(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Int16Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
