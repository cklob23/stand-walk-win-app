'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  DICTATION_WATCHDOG_MS,
  collectFinalTranscript,
  dictationErrorMessage,
  dictationUnavailableMessage,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
  type DictationRecognition,
} from '@/lib/speech-dictation'

interface UseSpeechDictationOptions {
  onFinalTranscript: (transcript: string) => void
  lang?: string
}

export function useSpeechDictation({ onFinalTranscript, lang }: UseSpeechDictationOptions) {
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<'idle' | 'listening' | 'permission' | 'error'>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const recognitionRef = useRef<DictationRecognition | null>(null)
  const wantListenRef = useRef(false)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFinalRef = useRef(onFinalTranscript)
  onFinalRef.current = onFinalTranscript

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const showUnavailable = useCallback((message: string) => {
    toast.error(message, { position: 'top-center' })
    setNotice(message)
    setListening(false)
    setStatus('idle')
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 6000)
  }, [])

  const detach = useCallback((rec: DictationRecognition | null) => {
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

  const stop = useCallback(() => {
    wantListenRef.current = false
    clearWatchdog()
    const rec = recognitionRef.current
    recognitionRef.current = null
    detach(rec)
    setListening(false)
    setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
  }, [clearWatchdog, detach])

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    },
    [],
  )

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      showUnavailable(dictationUnavailableMessage())
      return
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      showUnavailable(dictationUnavailableMessage())
      return
    }

    stop()

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
        setStatus('permission')
        if (message) toast.error(message)
      } else {
        setStatus('error')
        if (message) toast.error(message)
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
      detach(recognition)
      showUnavailable(dictationUnavailableMessage())
      return
    }

    setListening(true)
    setStatus('listening')
    clearWatchdog()
    watchdogRef.current = setTimeout(() => {
      if (!wantListenRef.current) return
      stop()
    }, DICTATION_WATCHDOG_MS)
  }, [clearWatchdog, detach, lang, showUnavailable, stop])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => stop(), [stop])

  return {
    listening,
    status,
    notice,
    toggle,
    stop,
    supported: isSpeechRecognitionSupported(),
  }
}
