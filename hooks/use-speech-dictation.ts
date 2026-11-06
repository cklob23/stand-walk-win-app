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
  dictationErrorMessage,
  dictationUnavailableMessage,
  getSpeechRecognitionCtor,
  isDictationSupported,
  isSpeechRecognitionSupported,
  preferRecorderMimeType,
  recordingFileName,
  shouldUseMediaRecorderDictation,
  type DictationRecognition,
} from '@/lib/speech-dictation'
import { transcribeErrorMessage } from '@/lib/message-transcribe'

export type DictationStatus =
  | 'idle'
  | 'listening'
  | 'recording'
  | 'transcribing'
  | 'permission'
  | 'error'

interface UseSpeechDictationOptions {
  onFinalTranscript: (transcript: string) => void
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

export function useSpeechDictation({ onFinalTranscript, lang }: UseSpeechDictationOptions) {
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const recognitionRef = useRef<DictationRecognition | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const wantListenRef = useRef(false)
  const startingRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const onFinalRef = useRef(onFinalTranscript)
  onFinalRef.current = onFinalTranscript

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const showNotice = useCallback((message: string, kind: 'error' | 'permission' | 'idle' = 'idle') => {
    if (message) toast.error(message, { position: 'top-center' })
    setNotice(message || null)
    setListening(false)
    setStatus(kind === 'permission' ? 'permission' : kind === 'error' ? 'error' : 'idle')
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    if (message) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), 6000)
    }
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

  const detachRecorder = useCallback(() => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onerror = null
      recorder.onstop = null
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          /* already stopped */
        }
      }
    }
    stopTracks()
  }, [stopTracks])

  const abortTranscribe = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const transcribeBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      abortTranscribe()
      const controller = new AbortController()
      abortRef.current = controller
      setListening(false)
      setStatus('transcribing')

      const transcribeTimeout = setTimeout(() => controller.abort(), DICTATION_TRANSCRIBE_TIMEOUT_MS)
      try {
        const form = new FormData()
        form.append('file', blob, recordingFileName(mimeType))
        if (lang) form.append('language', lang)
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
          showNotice(payload.error || transcribeErrorMessage(response.status, payload.code), 'error')
          return
        }
        const text = (payload.text || '').trim()
        if (!text) {
          showNotice(DICTATION_EMPTY_AUDIO_MESSAGE)
          return
        }
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
      }
    },
    [abortTranscribe, lang, showNotice],
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

      const recorder = recorderRef.current
      const shouldTranscribe = opts.transcribe !== false && recorder && recorder.state !== 'inactive'
      if (shouldTranscribe) {
        recorder.onstop = () => {
          const mime = recorder.mimeType || preferRecorderMimeType() || 'audio/mp4'
          const blob = new Blob(chunksRef.current, { type: mime })
          chunksRef.current = []
          recorderRef.current = null
          stopTracks()
          const elapsed = Date.now() - startedAtRef.current
          if (elapsed < DICTATION_MIN_RECORDING_MS || blob.size < 64) {
            showNotice(DICTATION_EMPTY_AUDIO_MESSAGE)
            return
          }
          void transcribeBlob(blob, mime)
        }
        try {
          recorder.stop()
        } catch {
          detachRecorder()
          setListening(false)
          setStatus((prev) => (prev === 'listening' || prev === 'recording' ? 'idle' : prev))
        }
        return
      }

      detachRecorder()
      setListening(false)
      setStatus((prev) =>
        prev === 'listening' || prev === 'recording' || prev === 'transcribing' ? 'idle' : prev,
      )
    },
    [abortTranscribe, clearWatchdog, detachRecorder, detachSpeech, showNotice, stopTracks, transcribeBlob],
  )

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    },
    [],
  )

  const startSpeech = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      showNotice(dictationUnavailableMessage())
      return
    }

    stop({ transcribe: false })

    const recognition = new Ctor()
    // iOS freezes with continuous + onend restart. One-shot is enough on desktop/Android.
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')

    recognition.onresult = (event) => {
      const transcript = collectFinalTranscript(event)
      if (transcript.trim()) onFinalRef.current(transcript)
      wantListenRef.current = false
      clearWatchdog()
      setListening(false)
      setStatus('idle')
    }

    recognition.onerror = (event) => {
      const message = dictationErrorMessage(event.error)
      if (event.error === 'no-speech') {
        wantListenRef.current = false
        clearWatchdog()
        setListening(false)
        setStatus('idle')
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
    }

    recognition.onend = () => {
      // Never restart — iOS Safari hangs in a start/onend loop.
      wantListenRef.current = false
      clearWatchdog()
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setListening(false)
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    wantListenRef.current = true
    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      wantListenRef.current = false
      detachSpeech(recognition)
      showNotice(dictationUnavailableMessage())
      return
    }

    setListening(true)
    setStatus('listening')
    clearWatchdog()
    watchdogRef.current = setTimeout(() => {
      if (!wantListenRef.current) return
      stop({ transcribe: false })
    }, DICTATION_WATCHDOG_MS)
  }, [clearWatchdog, detachSpeech, lang, showNotice, stop])

  const startRecorder = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showNotice(dictationUnavailableMessage())
      return
    }

    stop({ transcribe: false })
    startingRef.current = true
    chunksRef.current = []

    try {
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({ audio: true }),
        DICTATION_GETUSERMEDIA_TIMEOUT_MS,
        'mic-timeout',
      )
      if (!startingRef.current) {
        for (const track of stream.getTracks()) track.stop()
        return
      }

      const mimeType = preferRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        wantListenRef.current = false
        clearWatchdog()
        detachRecorder()
        showNotice(dictationErrorMessage('audio-capture'), 'error')
      }

      streamRef.current = stream
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      wantListenRef.current = true
      // Never pass a timeslice — periodic ondataavailable can hang Safari.
      recorder.start()
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
      stopTracks()
      const name = error instanceof Error ? error.name : ''
      const message = error instanceof Error ? error.message : ''
      if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'SecurityError') {
        showNotice(DICTATION_PERMISSION_MESSAGE, 'permission')
        return
      }
      if (message === 'mic-timeout') {
        showNotice(DICTATION_PERMISSION_MESSAGE, 'permission')
        return
      }
      showNotice(dictationErrorMessage('audio-capture'), 'error')
    }
  }, [clearWatchdog, detachRecorder, showNotice, stop, stopTracks])

  const start = useCallback(() => {
    if (startingRef.current || listening || status === 'recording' || status === 'transcribing') return
    // Hard rule: never construct/start Web Speech on iOS/iPadOS.
    if (isSpeechRecognitionSupported()) {
      startSpeech()
      return
    }
    if (shouldUseMediaRecorderDictation()) {
      void startRecorder()
      return
    }
    showNotice(dictationUnavailableMessage())
  }, [listening, showNotice, startRecorder, startSpeech, status])

  const toggle = useCallback(() => {
    if (startingRef.current && status !== 'recording') {
      startingRef.current = false
      stop({ transcribe: false })
      return
    }
    if (status === 'transcribing') {
      abortTranscribe()
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

  useEffect(
    () => () => {
      stop({ transcribe: false })
    },
    [stop],
  )

  return {
    listening,
    status,
    notice,
    toggle,
    stop: () => stop({ transcribe: false }),
    supported: isDictationSupported(),
  }
}
