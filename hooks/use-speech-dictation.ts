'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  DICTATION_EMPTY_AUDIO_MESSAGE,
  DICTATION_GETUSERMEDIA_TIMEOUT_MS,
  DICTATION_MIN_RECORDING_MS,
  DICTATION_PERMISSION_MESSAGE,
  DICTATION_RECORDING_MAX_MS,
  DICTATION_TRANSCRIBE_TIMEOUT_MS,
  DICTATION_WATCHDOG_MS,
  collectFinalTranscript,
  collectInterimTranscript,
  dictationErrorMessage,
  dictationUnavailableMessage,
  getSpeechRecognitionCtor,
  isDictationSupported,
  isSpeechRecognitionSupported,
  shouldUseMediaRecorderDictation,
  statusAfterDictationNoticeClear,
  type DictationRecognition,
} from '@/lib/speech-dictation'
import { shouldSkipWavFallback, transcribeErrorMessage } from '@/lib/message-transcribe'
import {
  PCM_TARGET_RATE,
  concatInt16,
  downsampleToRate,
  encodeWavFromPcm16,
  floatToPcm16,
  pcm16ToBase64,
  rmsLevel,
} from '@/lib/pcm-audio'
import {
  SCRIBE_TOKEN_PATH,
  buildScribeRealtimeUrl,
  joinLiveDictation,
  parseScribeRealtimeEvent,
  scribeAudioChunkMessage,
  transcribeFileFromPcmWav,
} from '@/lib/scribe-realtime'

export type DictationStatus =
  | 'idle'
  | 'listening'
  | 'recording'
  | 'transcribing'
  | 'permission'
  | 'error'

interface UseSpeechDictationOptions {
  onFinalTranscript: (transcript: string) => void
  onLiveTranscript?: (transcript: string) => void
  onSessionStart?: () => void
  lang?: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null
}

export function useSpeechDictation({
  onFinalTranscript,
  onLiveTranscript,
  onSessionStart,
  lang,
}: UseSpeechDictationOptions) {
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [volume, setVolume] = useState(0)
  const recognitionRef = useRef<DictationRecognition | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef(0)
  const socketRef = useRef<WebSocket | null>(null)
  const pcmChunksRef = useRef<Int16Array[]>([])
  const pendingScribeChunksRef = useRef<string[]>([])
  const committedRef = useRef('')
  const partialRef = useRef('')
  const startedAtRef = useRef(0)
  const wantListenRef = useRef(false)
  const startingRef = useRef(false)
  const finishingRef = useRef(false)
  const statusRef = useRef<DictationStatus>('idle')
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const sttConfigErrorRef = useRef<{ code: string; error: string } | null>(null)
  const onFinalRef = useRef(onFinalTranscript)
  const onLiveRef = useRef(onLiveTranscript)
  const onSessionStartRef = useRef(onSessionStart)
  onFinalRef.current = onFinalTranscript
  onLiveRef.current = onLiveTranscript
  onSessionStartRef.current = onSessionStart
  statusRef.current = status

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const emitLive = useCallback((committed: string, partial: string) => {
    const text = joinLiveDictation(committed, partial)
    onLiveRef.current?.(text)
    return text
  }, [])

  const showNotice = useCallback((message: string, kind: 'error' | 'permission' | 'idle' = 'idle') => {
    if (message) toast.error(message, { position: 'top-center' })
    setNotice(message || null)
    setListening(false)
    setVolume(0)
    setStatus(kind === 'permission' ? 'permission' : kind === 'error' ? 'error' : 'idle')
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    if (message) {
      noticeTimerRef.current = setTimeout(() => {
        setNotice(null)
        setStatus((prev) => statusAfterDictationNoticeClear(prev))
      }, 6000)
    }
  }, [])

  const stopVolumeLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    setVolume(0)
  }, [])

  const startVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    const samples = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      const normalized = new Float32Array(samples.length)
      for (let i = 0; i < samples.length; i++) normalized[i] = (samples[i] - 128) / 128
      setVolume(rmsLevel(normalized))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const stopTracks = useCallback(() => {
    const stream = streamRef.current
    streamRef.current = null
    if (!stream) return
    for (const track of stream.getTracks()) {
      try {
        track.stop()
      } catch {
        /* already stopped */
      }
    }
  }, [])

  const detachAudioGraph = useCallback(() => {
    stopVolumeLoop()
    const processor = processorRef.current
    processorRef.current = null
    if (processor) {
      processor.onaudioprocess = null
      try {
        processor.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    analyserRef.current = null
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => undefined)
    }
    stopTracks()
  }, [stopTracks, stopVolumeLoop])

  const detachSpeech = useCallback((rec: DictationRecognition | null) => {
    if (!rec) return
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
    try {
      rec.abort()
    } catch {
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
    }
  }, [])

  const closeSocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    try {
      socket.close()
    } catch {
      /* already closed */
    }
  }, [])

  const abortTranscribe = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const transcribeWav = useCallback(
    async (wav: Blob) => {
      abortTranscribe()
      const controller = new AbortController()
      abortRef.current = controller
      setListening(false)
      setStatus('transcribing')
      const transcribeTimeout = setTimeout(() => controller.abort(), DICTATION_TRANSCRIBE_TIMEOUT_MS)
      try {
        const file = transcribeFileFromPcmWav(wav)
        const form = new FormData()
        form.append('file', file, file.name)
        const response = await fetch('/api/messages/transcribe', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        })
        const payload = (await response.json().catch(() => ({}))) as {
          text?: string
          error?: string
          code?: string
        }
        if (!response.ok) {
          showNotice(
            payload.error || transcribeErrorMessage(response.status, payload.code),
            'error',
          )
          return
        }
        const text = (payload.text || '').trim()
        if (!text) {
          showNotice(DICTATION_EMPTY_AUDIO_MESSAGE)
          return
        }
        onLiveRef.current?.(text)
        onFinalRef.current(text)
        setStatus('idle')
        setNotice(null)
      } catch (error) {
        if (controller.signal.aborted) {
          setStatus('idle')
          setListening(false)
          return
        }
        showNotice(transcribeErrorMessage(500), 'error')
        console.error('[dictation transcribe]', error)
      } finally {
        clearTimeout(transcribeTimeout)
        if (abortRef.current === controller) abortRef.current = null
        finishingRef.current = false
      }
    },
    [abortTranscribe, showNotice],
  )

  const finishPcmSession = useCallback(
    (opts: { transcribe: boolean }) => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current)
        commitTimerRef.current = null
      }
      const pcm = concatInt16(pcmChunksRef.current)
      pcmChunksRef.current = []
      const elapsed = Date.now() - startedAtRef.current
      const live = joinLiveDictation(committedRef.current, partialRef.current)
      committedRef.current = ''
      partialRef.current = ''
      detachAudioGraph()
      closeSocket()
      if (!opts.transcribe) {
        finishingRef.current = false
        setListening(false)
        setStatus('idle')
        return
      }
      if (live.trim()) {
        onLiveRef.current?.(live)
        onFinalRef.current(live)
        finishingRef.current = false
        setListening(false)
        setStatus('idle')
        setNotice(null)
        return
      }
      if (elapsed < DICTATION_MIN_RECORDING_MS || pcm.length < 1600) {
        finishingRef.current = false
        showNotice(DICTATION_EMPTY_AUDIO_MESSAGE)
        return
      }
      const configError = sttConfigErrorRef.current
      if (configError && shouldSkipWavFallback(configError.code)) {
        finishingRef.current = false
        showNotice(configError.error, 'error')
        return
      }
      const wav = encodeWavFromPcm16(pcm, PCM_TARGET_RATE)
      void transcribeWav(wav)
    },
    [closeSocket, detachAudioGraph, showNotice, transcribeWav],
  )

  const stop = useCallback(
    (opts: { transcribe?: boolean } = {}) => {
      wantListenRef.current = false
      startingRef.current = false
      clearWatchdog()
      abortTranscribe()

      const rec = recognitionRef.current
      recognitionRef.current = null
      detachSpeech(rec)

      const shouldTranscribe = opts.transcribe !== false
      const socket = socketRef.current
      const hasPcm = pcmChunksRef.current.length > 0 || statusRef.current === 'recording'

      if (hasPcm && finishingRef.current && shouldTranscribe) return

      if (hasPcm) {
        finishingRef.current = true
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(scribeAudioChunkMessage('', { commit: true }))
          } catch {
            /* closing */
          }
          commitTimerRef.current = setTimeout(() => finishPcmSession({ transcribe: shouldTranscribe }), 600)
          return
        }
        finishPcmSession({ transcribe: shouldTranscribe })
        return
      }

      detachAudioGraph()
      closeSocket()
      setListening(false)
      setStatus((prev) =>
        prev === 'listening' || prev === 'recording' || prev === 'transcribing' ? 'idle' : prev,
      )
    },
    [abortTranscribe, clearWatchdog, closeSocket, detachAudioGraph, detachSpeech, finishPcmSession],
  )

  const stopRef = useRef(stop)
  stopRef.current = stop

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
      stopRef.current({ transcribe: false })
    },
    [],
  )

  const attachGraph = useCallback(
    async (stream: MediaStream, ctx: AudioContext) => {
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      startVolumeLoop()
      return { ctx, source, analyser }
    },
    [startVolumeLoop],
  )

  const startSpeech = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      showNotice(dictationUnavailableMessage())
      return
    }

    stop({ transcribe: false })
    onSessionStartRef.current?.()
    committedRef.current = ''
    partialRef.current = ''

    const Ctx = audioContextCtor()
    const ctx = Ctx ? new Ctx() : null
    if (ctx) void ctx.resume()

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        if (ctx) await attachGraph(stream, ctx)
      } catch {
        if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
      }
    }

    const recognition = new Ctor()
    // iOS freezes with continuous + onend restart. One-shot is enough on desktop/Android.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

    recognition.onresult = (event) => {
      const finals = collectFinalTranscript(event)
      const interim = collectInterimTranscript(event)
      if (finals.trim()) {
        committedRef.current = joinLiveDictation(committedRef.current, finals)
      }
      partialRef.current = interim
      const live = emitLive(committedRef.current, partialRef.current)
      if (finals.trim() && !interim.trim()) {
        onFinalRef.current(live)
      }
    }

    recognition.onerror = (event) => {
      const message = dictationErrorMessage(event.error)
      if (event.error === 'no-speech') {
        wantListenRef.current = false
        clearWatchdog()
        setListening(false)
        setStatus('idle')
        detachAudioGraph()
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showNotice(message, 'permission')
      } else {
        showNotice(message, 'error')
      }
      wantListenRef.current = false
      clearWatchdog()
      setListening(false)
      detachAudioGraph()
    }

    recognition.onend = () => {
      // Never restart — iOS Safari hangs in a start/onend loop.
      wantListenRef.current = false
      clearWatchdog()
      if (recognitionRef.current === recognition) recognitionRef.current = null
      const live = joinLiveDictation(committedRef.current, partialRef.current)
      if (live.trim()) onFinalRef.current(live)
      setListening(false)
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
      detachAudioGraph()
    }

    wantListenRef.current = true
    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      wantListenRef.current = false
      detachSpeech(recognition)
      detachAudioGraph()
      showNotice(dictationUnavailableMessage())
      return
    }

    setListening(true)
    setStatus('listening')
    setNotice(null)
    clearWatchdog()
    watchdogRef.current = setTimeout(() => {
      if (!wantListenRef.current) return
      stop({ transcribe: false })
    }, DICTATION_WATCHDOG_MS)
  }, [attachGraph, clearWatchdog, detachAudioGraph, detachSpeech, emitLive, lang, showNotice, stop])

  const startRealtime = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showNotice(dictationUnavailableMessage())
      return
    }

    stop({ transcribe: false })
    startingRef.current = true
    finishingRef.current = false
    pcmChunksRef.current = []
    pendingScribeChunksRef.current = []
    committedRef.current = ''
    partialRef.current = ''
    sttConfigErrorRef.current = null
    onSessionStartRef.current?.()

    // Create AudioContext during the tap, before awaiting getUserMedia, so iOS
    // does not drop the user-gesture for resume().
    const Ctx = audioContextCtor()
    if (!Ctx) {
      startingRef.current = false
      showNotice(dictationUnavailableMessage())
      return
    }
    const ctx = new Ctx()
    audioCtxRef.current = ctx
    void ctx.resume()

    const tokenPromise = fetch(SCRIBE_TOKEN_PATH, { method: 'POST' })
      .then(async (tokenRes) => {
        const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
          token?: string
          error?: string
          code?: string
        }
        if (tokenRes.ok && tokenJson.token) return tokenJson.token
        const code = tokenJson.code || ''
        const error = tokenJson.error || transcribeErrorMessage(tokenRes.status, code)
        if (shouldSkipWavFallback(code)) {
          sttConfigErrorRef.current = { code, error }
        }
        console.warn('[dictation] scribe token unavailable; WAV fallback on stop', code || tokenRes.status)
        return ''
      })
      .catch(() => '')

    try {
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        }),
        DICTATION_GETUSERMEDIA_TIMEOUT_MS,
        'mic-timeout',
      )
      if (!startingRef.current) {
        for (const track of stream.getTracks()) track.stop()
        detachAudioGraph()
        return
      }
      streamRef.current = stream
      const graph = await attachGraph(stream, ctx)

      const processor = graph.ctx.createScriptProcessor(4096, 1, 1)
      const mute = graph.ctx.createGain()
      mute.gain.value = 0
      graph.source.connect(processor)
      processor.connect(mute)
      mute.connect(graph.ctx.destination)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (!wantListenRef.current) return
        const input = event.inputBuffer.getChannelData(0)
        const downsampled = downsampleToRate(new Float32Array(input), graph.ctx.sampleRate, PCM_TARGET_RATE)
        const pcm = floatToPcm16(downsampled)
        if (!pcm.length) return
        pcmChunksRef.current.push(pcm)
        const encoded = pcm16ToBase64(pcm)
        const socket = socketRef.current
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(scribeAudioChunkMessage(encoded))
        } else {
          pendingScribeChunksRef.current.push(encoded)
        }
      }

      const token = await tokenPromise

      if (token) {
        const spokenLang = lang || (typeof navigator !== 'undefined' ? navigator.language : undefined)
        const socket = new WebSocket(buildScribeRealtimeUrl(token, spokenLang))
        socketRef.current = socket
        socket.onopen = () => {
          const queued = pendingScribeChunksRef.current
          pendingScribeChunksRef.current = []
          for (const encoded of queued) {
            if (socket.readyState === WebSocket.OPEN) socket.send(scribeAudioChunkMessage(encoded))
          }
        }
        socket.onmessage = (event) => {
          try {
            const parsed = parseScribeRealtimeEvent(JSON.parse(String(event.data)))
            if (!parsed) return
            if (parsed.type === 'partial_transcript') {
              partialRef.current = parsed.text
              emitLive(committedRef.current, partialRef.current)
            }
            if (parsed.type === 'final_transcript') {
              partialRef.current = parsed.text
              emitLive(committedRef.current, partialRef.current)
            }
            if (parsed.type === 'committed_transcript') {
              if (parsed.text) committedRef.current = joinLiveDictation(committedRef.current, parsed.text)
              partialRef.current = ''
              emitLive(committedRef.current, '')
            }
          } catch {
            /* ignore malformed frames */
          }
        }
        socket.onerror = () => {
          console.warn('[dictation] scribe realtime socket error; WAV fallback on stop')
        }
      }

      startedAtRef.current = Date.now()
      wantListenRef.current = true
      startingRef.current = false
      setListening(true)
      setStatus('recording')
      setNotice(null)
      clearWatchdog()
      watchdogRef.current = setTimeout(() => {
        if (!wantListenRef.current) return
        stop({ transcribe: true })
      }, DICTATION_RECORDING_MAX_MS)
    } catch (error) {
      startingRef.current = false
      wantListenRef.current = false
      detachAudioGraph()
      closeSocket()
      const name = error instanceof Error ? error.name : ''
      const message = error instanceof Error ? error.message : ''
      if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'SecurityError' || message === 'mic-timeout') {
        showNotice(DICTATION_PERMISSION_MESSAGE, 'permission')
        return
      }
      showNotice(dictationErrorMessage('audio-capture'), 'error')
    }
  }, [attachGraph, clearWatchdog, closeSocket, detachAudioGraph, emitLive, lang, showNotice, stop])

  const start = useCallback(() => {
    if (startingRef.current || listening || status === 'recording' || status === 'transcribing') return
    // Hard rule: never construct/start Web Speech on iOS/iPadOS.
    if (isSpeechRecognitionSupported()) {
      void startSpeech()
      return
    }
    if (shouldUseMediaRecorderDictation()) {
      // Never pass a timeslice / never upload iOS MediaRecorder fMP4 — stream PCM16.
      void startRealtime()
      return
    }
    showNotice(dictationUnavailableMessage())
  }, [listening, showNotice, startRealtime, startSpeech, status])

  const toggle = useCallback(() => {
    if (startingRef.current && status !== 'recording') {
      startingRef.current = false
      stop({ transcribe: false })
      return
    }
    if (status === 'transcribing') {
      abortTranscribe()
      finishingRef.current = false
      setStatus('idle')
      setListening(false)
      return
    }
    if (listening || status === 'recording' || status === 'listening') {
      stop({ transcribe: status === 'recording' })
      return
    }
    start()
  }, [abortTranscribe, listening, start, status, stop])

  return {
    listening,
    status,
    notice,
    volume,
    toggle,
    stop: () => stop({ transcribe: false }),
    supported: isDictationSupported(),
  }
}
