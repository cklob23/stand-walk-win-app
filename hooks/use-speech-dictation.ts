'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  DICTATION_UNSUPPORTED_MESSAGE,
  collectFinalTranscript,
  dictationErrorMessage,
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
  const recognitionRef = useRef<DictationRecognition | null>(null)
  const wantListenRef = useRef(false)
  const onFinalRef = useRef(onFinalTranscript)
  onFinalRef.current = onFinalTranscript

  const stop = useCallback(() => {
    wantListenRef.current = false
    const rec = recognitionRef.current
    recognitionRef.current = null
    try {
      rec?.stop()
    } catch {
      try {
        rec?.abort()
      } catch {
        /* already stopped */
      }
    }
    setListening(false)
    setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      toast.error(DICTATION_UNSUPPORTED_MESSAGE)
      setStatus('error')
      setListening(false)
      return
    }

    stop()
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
    wantListenRef.current = true
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const transcript = collectFinalTranscript(event)
      if (transcript.trim()) onFinalRef.current(transcript)
    }

    recognition.onerror = (event) => {
      const message = dictationErrorMessage(event.error)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('permission')
        toast.error(message)
        wantListenRef.current = false
        setListening(false)
        return
      }
      if (event.error === 'no-speech') return
      setStatus('error')
      if (message) toast.error(message)
      wantListenRef.current = false
      setListening(false)
    }

    recognition.onend = () => {
      if (wantListenRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start()
          return
        } catch {
          wantListenRef.current = false
        }
      }
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setListening(false)
      setStatus((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    try {
      recognition.start()
      setListening(true)
      setStatus('listening')
    } catch {
      toast.error(DICTATION_UNSUPPORTED_MESSAGE)
      setStatus('error')
      wantListenRef.current = false
      setListening(false)
    }
  }, [lang, stop])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => stop(), [stop])

  return {
    listening,
    status,
    toggle,
    stop,
    supported: isSpeechRecognitionSupported(),
  }
}
