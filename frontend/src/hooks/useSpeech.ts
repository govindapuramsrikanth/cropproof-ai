import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '../lib/api'

export type SpeechLanguage = 'en' | 'te' | 'en-IN' | 'te-IN'
export type SpeechStatus =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'recording_fallback'
  | 'transcribing'
  | 'error'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal: boolean
}

interface SpeechRecognitionResultEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface UseSpeechOptions {
  onTranscript?: (transcript: string) => void
}

interface TranscriptionResponse {
  transcript: string
  language: string
  source: string
}

interface UseSpeechResult {
  startListening: (language?: SpeechLanguage) => void
  stopListening: () => void
  isListening: boolean
  isSupported: boolean
  status: SpeechStatus
  interimTranscript: string
  error: string | null
  inputLevel: number
  isCheckingAudioInput: boolean
  isAudioInputReady: boolean
  audioInputError: string | null
  speak: (text: string, language?: SpeechLanguage) => void
}

function getRecognitionConstructor():
  | SpeechRecognitionConstructor
  | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

function canCaptureAudio(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

function speechLocale(language: SpeechLanguage): 'en-IN' | 'te-IN' {
  return language === 'te' || language === 'te-IN' ? 'te-IN' : 'en-IN'
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return `Microphone or speech access was denied (${code}). Allow microphone access for localhost and try again.`
    case 'no-speech':
      return 'No speech was detected by browser recognition. Audio recording is continuing; keep speaking and press Stop to transcribe, or retry/use a sample.'
    case 'audio-capture':
      return 'No working microphone was found (audio-capture). Check that a microphone is connected.'
    case 'network':
      return 'Speech recognition encountered a network error. Recording audio for server transcription; press Stop when finished.'
    case 'aborted':
      return 'Speech recognition was stopped before it finished (aborted).'
    default:
      return `Speech recognition failed (${code || 'unknown error'}). Try again or type your description.`
  }
}

function captureErrorMessage(reason: unknown): string {
  const name = reason instanceof Error ? reason.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone access was denied. Allow microphone access for localhost and try again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect a microphone or type your description.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is busy or unavailable. Close other recording apps and try again.'
  }
  return reason instanceof Error
    ? `Unable to access the microphone: ${reason.message}`
    : 'Unable to access the microphone. Check browser permissions and try again.'
}

function supportedRecorderMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ]
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

export function useSpeech(
  { onTranscript }: UseSpeechOptions = {},
): UseSpeechResult {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserFrameRef = useRef<number | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const onTranscriptRef = useRef(onTranscript)
  const sessionRef = useRef(0)
  const languageRef = useRef<SpeechLanguage>('en-IN')
  const fallbackRequestedRef = useRef(false)
  const transcribeAfterRecordingRef = useRef(false)
  const stopRequestedRef = useRef(false)
  const captureErrorRef = useRef<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [isCheckingAudioInput, setIsCheckingAudioInput] = useState(false)
  const [isAudioInputReady, setIsAudioInputReady] = useState(false)
  const [audioInputError, setAudioInputError] = useState<string | null>(null)
  const isSupported = Boolean(getRecognitionConstructor()) || canCaptureAudio()

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const stopInputMeter = (updateUi = true) => {
    if (analyserFrameRef.current !== null) {
      cancelAnimationFrame(analyserFrameRef.current)
      analyserFrameRef.current = null
    }
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((reason: unknown) => {
        console.warn('[CropProof voice] AudioContext close failed', reason)
      })
    }
    if (updateUi) setInputLevel(0)
  }

  const startInputMeter = (stream: MediaStream) => {
    try {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) {
        setAudioInputError('Microphone is connected, but this browser cannot show its input level.')
        return
      }

      const audioContext = new AudioContextConstructor()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      const samples = new Uint8Array(analyser.fftSize)
      let lastUpdate = 0
      const updateLevel = (timestamp: number) => {
        if (audioContextRef.current !== audioContext) return
        analyser.getByteTimeDomainData(samples)
        let squaredTotal = 0
        for (const sample of samples) {
          const normalized = (sample - 128) / 128
          squaredTotal += normalized * normalized
        }
        const rms = Math.sqrt(squaredTotal / samples.length)
        if (timestamp - lastUpdate >= 75) {
          setInputLevel(Math.min(1, rms * 4))
          lastUpdate = timestamp
        }
        analyserFrameRef.current = requestAnimationFrame(updateLevel)
      }
      analyserFrameRef.current = requestAnimationFrame(updateLevel)
      void audioContext.resume().catch((reason: unknown) => {
        if (audioContextRef.current !== audioContext) return
        console.warn('[CropProof voice] AudioContext resume failed', reason)
        stopInputMeter()
        setAudioInputError('Microphone is connected, but its live level meter could not start.')
      })
    } catch (reason) {
      console.warn('[CropProof voice] microphone level meter unavailable', reason)
      stopInputMeter()
      setAudioInputError('Microphone is connected, but its live level meter could not start.')
    }
  }

  const releaseAudioStream = () => {
    const stream = streamRef.current
    streamRef.current = null
    stopInputMeter()
    stream?.getTracks().forEach((track) => track.stop())
    setIsAudioInputReady(false)
    setIsCheckingAudioInput(false)
  }

  const transcribeRecordedAudio = async (
    audio: Blob,
    session: number,
  ): Promise<void> => {
    if (session !== sessionRef.current) return
    if (audio.size === 0) {
      setError('No audio was captured. Please record again and speak after the mic starts.')
      setStatus('error')
      setIsListening(false)
      return
    }

    setStatus('transcribing')
    setIsListening(false)
    setInterimTranscript('')
    const formData = new FormData()
    const extension = audio.type.includes('ogg') ? 'ogg' : 'webm'
    formData.append('file', audio, `crop-loss-voice.${extension}`)
    formData.append('language', speechLocale(languageRef.current))

    console.info('[CropProof voice] sending audio to transcription endpoint', {
      language: speechLocale(languageRef.current),
      bytes: audio.size,
      mimeType: audio.type || 'audio/webm',
    })
    try {
      const result = await apiRequest<TranscriptionResponse>(
        '/api/claims/transcribe',
        { method: 'POST', body: formData },
      )
      if (session !== sessionRef.current) return
      const transcript = result.transcript.trim()
      if (!transcript) {
        throw new Error('The transcription service returned no spoken words.')
      }
      onTranscriptRef.current?.(transcript)
      setError(null)
      setStatus('idle')
      console.info('[CropProof voice] audio transcription completed', {
        language: result.language,
        source: result.source,
      })
    } catch (reason) {
      if (session !== sessionRef.current) return
      const message =
        reason instanceof Error
          ? reason.message
          : 'Audio transcription failed. Please try again or type your description.'
      console.error('[CropProof voice] audio transcription failed', message)
      setError(message)
      setStatus('error')
    }
  }

  const stopAudioCapture = (
    session: number,
    shouldTranscribe: boolean,
  ) => {
    if (session !== sessionRef.current) return
    const recorder = recorderRef.current
    if (recorder) {
      if (recorder.state !== 'inactive') {
        transcribeAfterRecordingRef.current = shouldTranscribe
        try {
          recorder.stop()
        } catch (reason) {
          const message = captureErrorMessage(reason)
          console.error('[CropProof voice] MediaRecorder stop failed', message)
          setError(message)
          setStatus('error')
          setIsListening(false)
          releaseAudioStream()
        }
      }
      return
    }
    releaseAudioStream()
    if (!shouldTranscribe) {
      setIsListening(false)
      setStatus((current) => (current === 'error' ? 'error' : 'idle'))
    }
  }

  const startAudioCapture = async (session: number): Promise<void> => {
    if (!canCaptureAudio()) {
      setIsCheckingAudioInput(false)
      const message =
        'Audio recording is unavailable in this browser. Allow speech recognition or type your description.'
      captureErrorRef.current = message
      console.error('[CropProof voice] MediaRecorder fallback unavailable', message)
      if (fallbackRequestedRef.current) {
        setError(message)
        setStatus('error')
        setIsListening(false)
      }
      return
    }

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (session !== sessionRef.current || stopRequestedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        if (session === sessionRef.current) setIsCheckingAudioInput(false)
        if (session === sessionRef.current && fallbackRequestedRef.current) {
          setError('Recording stopped before the microphone was ready. Please try again.')
          setStatus('error')
          setIsListening(false)
        }
        return
      }

      const mimeType = supportedRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = recorder
      setIsAudioInputReady(true)
      setIsCheckingAudioInput(false)
      setAudioInputError(null)
      startInputMeter(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        const message = 'The microphone audio recorder encountered an error. Please try again.'
        console.error('[CropProof voice] MediaRecorder error')
        captureErrorRef.current = message
        setError(message)
        setStatus('error')
        setIsListening(false)
        stopAudioCapture(session, false)
      }
      recorder.onstop = () => {
        const audio = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        const shouldTranscribe = transcribeAfterRecordingRef.current
        audioChunksRef.current = []
        recorderRef.current = null
        releaseAudioStream()
        console.info('[CropProof voice] MediaRecorder stopped', {
          bytes: audio.size,
          transcribe: shouldTranscribe,
        })
        if (session !== sessionRef.current) return
        if (shouldTranscribe) {
          void transcribeRecordedAudio(audio, session)
        } else {
          setIsListening(false)
          setStatus((current) => (current === 'error' ? 'error' : 'idle'))
        }
      }
      recorder.start(250)
      console.info('[CropProof voice] MediaRecorder backup started', {
        mimeType: recorder.mimeType || 'browser default',
      })
      if (fallbackRequestedRef.current) {
        setStatus('recording_fallback')
        setIsListening(true)
      }
    } catch (reason) {
      const message = captureErrorMessage(reason)
      captureErrorRef.current = message
      recorderRef.current = null
      streamRef.current = null
      stream?.getTracks().forEach((track) => track.stop())
      stopInputMeter()
      setIsAudioInputReady(false)
      setIsCheckingAudioInput(false)
      setAudioInputError(message)
      console.error('[CropProof voice] microphone capture failed', message)
      if (session === sessionRef.current && fallbackRequestedRef.current) {
        setError(message)
        setStatus('error')
        setIsListening(false)
      }
    }
  }

  const startListening = (language: SpeechLanguage = 'en-IN') => {
    if (isListening) return

    const session = sessionRef.current + 1
    sessionRef.current = session
    languageRef.current = language
    stopRequestedRef.current = false
    fallbackRequestedRef.current = false
    transcribeAfterRecordingRef.current = false
    captureErrorRef.current = null
    setError(null)
    setInterimTranscript('')
    setInputLevel(0)
    setIsCheckingAudioInput(true)
    setIsAudioInputReady(false)
    setAudioInputError(null)
    setStatus('starting')
    setIsListening(true)

    const Recognition = getRecognitionConstructor()
    let shouldStartAudioCapture = !Recognition
    let recognition: SpeechRecognitionLike | null = null
    if (Recognition) {
      try {
        const activeRecognition = new Recognition()
        recognition = activeRecognition
        activeRecognition.lang = speechLocale(language)
        activeRecognition.continuous = true
        activeRecognition.interimResults = true
        activeRecognition.maxAlternatives = 1
        activeRecognition.onstart = () => {
          if (session !== sessionRef.current) return
          console.info('[CropProof voice] SpeechRecognition onstart', {
            language: activeRecognition.lang,
          })
          setError(null)
          setStatus('listening')
          setIsListening(true)
        }
        activeRecognition.onresult = (event) => {
          if (session !== sessionRef.current) return
          const finalParts: string[] = []
          const interimParts: string[] = []
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index]
            const value = result[0]?.transcript?.trim()
            if (!value) continue
            if (result.isFinal) finalParts.push(value)
            else interimParts.push(value)
          }
          const interim = interimParts.join(' ').trim()
          console.info('[CropProof voice] SpeechRecognition onresult', {
            finalSegments: finalParts.length,
            hasInterim: Boolean(interim),
          })
          setInterimTranscript(interim)
          if (finalParts.length > 0) {
            onTranscriptRef.current?.(finalParts.join(' ').trim())
          }
        }
        activeRecognition.onerror = (event) => {
          if (session !== sessionRef.current) return
          const code = event.error || 'unknown'
          console.error('[CropProof voice] SpeechRecognition onerror', {
            error: code,
            message: event.message,
          })
          const fallbackError = captureErrorRef.current
          const canUseAudioFallback = code === 'no-speech' || code === 'network'
          setError(
            fallbackError && canUseAudioFallback
              ? `${speechErrorMessage(code)} ${fallbackError}`
              : speechErrorMessage(code),
          )
          if (canUseAudioFallback) {
            fallbackRequestedRef.current = true
            shouldStartAudioCapture = true
            setStatus(fallbackError ? 'error' : 'recording_fallback')
            setIsListening(!fallbackError)
            try {
              activeRecognition.stop()
            } catch (reason) {
              console.error(
                '[CropProof voice] unable to stop network-failed recognition',
                reason,
              )
            }
          } else {
            stopRequestedRef.current = true
            setStatus('error')
            setIsListening(false)
            stopAudioCapture(session, false)
            try {
              activeRecognition.stop()
            } catch (reason) {
              console.warn('[CropProof voice] unable to stop failed recognition', reason)
            }
          }
        }
        activeRecognition.onend = () => {
          if (session !== sessionRef.current) return
          console.info('[CropProof voice] SpeechRecognition onend', {
            fallbackRecording: fallbackRequestedRef.current,
          })
          recognitionRef.current = null
          if (fallbackRequestedRef.current) {
            const captureError = captureErrorRef.current
            setStatus(captureError ? 'error' : 'recording_fallback')
            setIsListening(!captureError)
            return
          }
          stopRequestedRef.current = true
          stopAudioCapture(session, false)
          setInterimTranscript('')
        }
        recognitionRef.current = activeRecognition
        activeRecognition.start()
        shouldStartAudioCapture = true
      } catch (reason) {
        if (recognition) {
          recognition.onstart = null
          recognition.onresult = null
          recognition.onerror = null
          recognition.onend = null
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null
          }
        }
        const message =
          reason instanceof Error
            ? reason.message
            : 'Unable to start browser speech recognition.'
        const isNetworkError =
          reason instanceof Error &&
          (reason.name === 'NetworkError' || /network/i.test(reason.message))
        console.error('[CropProof voice] SpeechRecognition start failed', message)
        setError(
          isNetworkError
            ? speechErrorMessage('network')
            : `Unable to start speech recognition: ${message}`,
        )
        if (isNetworkError) {
          fallbackRequestedRef.current = true
          shouldStartAudioCapture = true
          setStatus('recording_fallback')
          setIsListening(true)
        } else {
          stopRequestedRef.current = true
          setIsCheckingAudioInput(false)
          setStatus('error')
          setIsListening(false)
        }
      }
    } else {
      fallbackRequestedRef.current = true
      setError(
        'Browser speech recognition is unavailable. Recording audio for server transcription; press Stop when finished.',
      )
      setStatus('recording_fallback')
    }

    if (shouldStartAudioCapture) void startAudioCapture(session)
  }

  const stopListening = () => {
    const session = sessionRef.current
    console.info('[CropProof voice] stop requested', {
      fallbackRecording: fallbackRequestedRef.current,
    })
    stopRequestedRef.current = true
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try {
        recognition.stop()
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : 'Unable to stop speech recognition.'
        console.error('[CropProof voice] SpeechRecognition stop failed', message)
        setError(message)
      }
    }

    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      setIsListening(false)
      transcribeAfterRecordingRef.current = fallbackRequestedRef.current
      stopAudioCapture(session, fallbackRequestedRef.current)
      if (!fallbackRequestedRef.current) setInterimTranscript('')
      return
    }

    if (fallbackRequestedRef.current) {
      const message =
        captureErrorRef.current ||
        'The audio recorder was not ready when Stop was pressed. Please record again.'
      setError(message)
      setStatus('error')
    } else {
      setStatus((current) => (current === 'error' ? 'error' : 'idle'))
    }
    setIsListening(false)
    setInterimTranscript('')
  }

  useEffect(
    () => () => {
      sessionRef.current += 1
      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        try {
          recognition.stop()
        } catch {
          console.info('[CropProof voice] recognition already stopped during cleanup')
        }
      }
      const recorder = recorderRef.current
      recorderRef.current = null
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      const stream = streamRef.current
      streamRef.current = null
      stream?.getTracks().forEach((track) => track.stop())
      stopInputMeter(false)
    },
    [],
  )

  const speak = useCallback((text: string, language: SpeechLanguage = 'en-IN') => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      setError('Speech playback is not supported in this browser.')
      return
    }
    try {
      setError(null)
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speechLocale(language)
      utterance.onerror = (event) => {
        setError(event.error || 'Unable to play speech.')
      }
      window.speechSynthesis.speak(utterance)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to play speech.',
      )
    }
  }, [])

  return {
    startListening,
    stopListening,
    isListening,
    isSupported,
    status,
    interimTranscript,
    error,
    inputLevel,
    isCheckingAudioInput,
    isAudioInputReady,
    audioInputError,
    speak,
  }
}
