import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Mic, MicOff, Sparkles, Volume2 } from 'lucide-react'

import { useSpeech } from '../hooks/useSpeech'
import { VisualTapSelector } from './AgrarianVisuals'
import { labels, type Language } from '../i18n/labels'
import { apiRequest, jsonRequest } from '../lib/api'
import type { CalamityType, IncidentCase } from '../types'

interface ExtractResponse extends IncidentCase {
  ai_mode: string
  next_question_en: string | null
  next_question_te: string | null
  mandal?: string | null
  farmer_name?: string | null
  summary?: string | null
  hours_elapsed?: number | null
  hours_remaining?: number | null
  within_72h_window?: boolean | null
}

interface VoiceIntakeProps {
  caseData: IncidentCase
  language: Language
  transcript: string
  onTranscriptChange: (value: string) => void
  nextQuestionEn: string | null
  nextQuestionTe: string | null
  onExtracted: (result: ExtractResponse) => void
  onDraftFieldChange: (
    field: 'crop' | 'calamity_type' | 'incident_date',
    value: string,
  ) => void
  onContinue: () => void
}

const quickScenarios: Array<{
  id: string
  titleEn: string
  titleTe: string
  crop: string
  calamity: CalamityType
  textEn: string
  textTe: string
}> = [
  {
    id: 'nalgonda-paddy-flood',
    titleEn: 'Flooded paddy · Nalgonda',
    titleTe: 'నీటమునిగిన వరి · నల్గొండ',
    crop: 'Paddy',
    calamity: 'flood_inundation',
    textEn:
      'Heavy rain flooded my 2.5 acres of paddy in Miryalaguda, Nalgonda yesterday.',
    textTe:
      'నిన్న నల్గొండ జిల్లా మిర్యాలగూడలో భారీ వర్షానికి నా 2.5 ఎకరాల వరి పంట మునిగిపోయింది.',
  },
  {
    id: 'warangal-cotton-rain',
    titleEn: 'Rain-damaged cotton · Warangal',
    titleTe: 'వర్షంతో దెబ్బతిన్న పత్తి · వరంగల్',
    crop: 'Cotton',
    calamity: 'unseasonal_rain',
    textEn:
      'Unseasonal rain damaged my 3 acres of cotton in Parkal, Warangal yesterday.',
    textTe:
      'నిన్న వరంగల్ జిల్లా పరకాలలో అకాల వర్షం వల్ల నా 3 ఎకరాల పత్తి పంట దెబ్బతింది.',
  },
  {
    id: 'khammam-maize-waterlogging',
    titleEn: 'Waterlogged maize · Khammam',
    titleTe: 'నీరు నిలిచిన మొక్కజొన్న · ఖమ్మం',
    crop: 'Maize',
    calamity: 'flood_inundation',
    textEn:
      'Floodwater has waterlogged my 1.5 acres of maize in Wyra, Khammam today.',
    textTe:
      'ఈరోజు ఖమ్మం జిల్లా వైరాలో నీరు నిలిచిపోవడంతో నా 1.5 ఎకరాల మొక్కజొన్న పంట నీటమునిగింది.',
  },
]
const quickIntakeStartedAt = Date.now()

function isCalamityType(value: string | null): value is CalamityType {
  return (
    value === 'flood_inundation' ||
    value === 'hailstorm' ||
    value === 'heavy_rain' ||
    value === 'unseasonal_rain' ||
    value === 'post_harvest_rain' ||
    value === 'other'
  )
}

export function VoiceIntake({
  caseData,
  language,
  transcript,
  onTranscriptChange,
  nextQuestionEn,
  nextQuestionTe,
  onExtracted,
  onDraftFieldChange,
  onContinue,
}: VoiceIntakeProps) {
  const copy = labels[language]
  const [isExtracting, setIsExtracting] = useState(false)
  const [hasExtracted, setHasExtracted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(quickIntakeStartedAt)
  const transcriptRef = useRef(transcript)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])
  const question =
    (language === 'te' ? nextQuestionTe : nextQuestionEn) ||
    (language === 'te'
      ? 'మీ పంటకు ఏమి జరిగింది? ఎప్పుడు, ఎక్కడ జరిగిందో చెప్పండి.'
      : 'Tell me what happened to your crop, when it happened, and where the field is.')
  const appendSpeechTranscript = (finalText: string) => {
    const addition = finalText.trim()
    if (!addition) return
    const previous = transcriptRef.current.trim()
    const updated = previous ? `${previous} ${addition}` : addition
    transcriptRef.current = updated
    onTranscriptChange(updated)
  }
  const updateTranscript = (value: string) => {
    transcriptRef.current = value
    onTranscriptChange(value)
  }
  const {
    startListening,
    stopListening,
    isListening,
    isSupported,
    status: speechStatus,
    interimTranscript,
    speak,
    error: speechError,
    inputLevel,
    isCheckingAudioInput,
    isAudioInputReady,
    audioInputError,
  } = useSpeech({ onTranscript: appendSpeechTranscript })

  const speechStatusText =
    speechStatus === 'starting'
      ? language === 'te'
        ? 'మైక్రోఫోన్ సిద్ధమవుతోంది…'
        : 'Starting microphone…'
      : speechStatus === 'listening'
        ? language === 'te'
          ? 'వింటున్నాం… మాట్లాడటం ప్రారంభించండి.'
          : 'Listening… Start speaking.'
        : speechStatus === 'recording_fallback'
          ? language === 'te'
            ? 'ఆడియో రికార్డ్ అవుతోంది. పూర్తయ్యాక ఆపండి; తర్వాత మాటలను టెక్స్ట్‌గా మారుస్తాం.'
            : 'Recording audio for transcription. Press Stop when you finish speaking.'
          : speechStatus === 'transcribing'
            ? language === 'te'
              ? 'మీ ఆడియోను టెక్స్ట్‌గా మారుస్తున్నాం…'
              : 'Transcribing your audio…'
            : speechStatus === 'error'
              ? language === 'te'
                ? 'వాయిస్ గుర్తింపులో సమస్య ఏర్పడింది.'
                : 'Voice capture needs attention.'
              : isSupported
                ? language === 'te'
                  ? 'మైక్రోఫోన్‌ను నొక్కి మాట్లాడండి.'
                  : 'Tap the microphone and speak.'
                : language === 'te'
                  ? 'ఈ బ్రౌజర్‌లో మైక్రోఫోన్ అందుబాటులో లేదు. టైప్ చేయండి.'
                  : 'Microphone capture is unavailable here. You can type instead.'

  const capturedFields = [
    { label: copy.fields.crop, value: caseData.crop },
    {
      label: copy.fields.calamity,
      value: isCalamityType(caseData.calamity_type)
        ? caseData.calamity_type.replaceAll('_', ' ')
        : caseData.calamity_type,
    },
    { label: copy.fields.incidentDate, value: caseData.incident_date },
    { label: copy.fields.district, value: caseData.district },
    { label: copy.fields.village, value: caseData.village },
    {
      label: copy.fields.affectedArea,
      value:
        caseData.affected_area_acres === null
          ? null
          : `${caseData.affected_area_acres}`,
    },
    { label: copy.fields.insuranceStatus, value: caseData.insurance_status },
  ].filter((field) => field.value)

  const extractDetails = async (description = transcript) => {
    if (!description.trim()) return
    setIsExtracting(true)
    setError(null)
    try {
      const result = await apiRequest<ExtractResponse>(
        `/api/cases/${caseData.id}/extract`,
        jsonRequest('POST', { transcript: description, language }),
      )
      setHasExtracted(true)
      onExtracted(result)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to extract details.',
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const applyQuickScenario = async (scenario: (typeof quickScenarios)[number]) => {
    const description = language === 'te' ? scenario.textTe : scenario.textEn
    updateTranscript(description)
    onDraftFieldChange('crop', scenario.crop)
    onDraftFieldChange('calamity_type', scenario.calamity)
    await extractDetails(description)
  }

  const incidentDate = caseData.incident_date?.slice(0, 10) ?? ''
  const parsedIncidentStart = incidentDate
    ? Date.parse(`${incidentDate}T00:00:00+05:30`)
    : Number.NaN
  const incidentStart = Number.isFinite(parsedIncidentStart)
    ? parsedIncidentStart
    : quickIntakeStartedAt
  const deadlineAt = incidentStart + 72 * 60 * 60 * 1000
  const remainingMilliseconds = deadlineAt - now
  const remainingSeconds = Math.max(0, Math.ceil(remainingMilliseconds / 1000))
  const countdown = [
    Math.floor(remainingSeconds / 3600),
    Math.floor((remainingSeconds % 3600) / 60),
    remainingSeconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
  const within72Hours = remainingMilliseconds > 0

  return (
    <section className="space-y-6" aria-labelledby="voice-intake-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Step 1 · {copy.steps.voiceTextIntake}
        </p>
        <h2
          id="voice-intake-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {language === 'te' ? 'మీ పంట నష్టం గురించి చెప్పండి' : 'Tell us about the crop loss'}
        </h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          {language === 'te'
            ? 'తెలుగులో లేదా ఇంగ్లీష్‌లో మాట్లాడండి, లేదా మీ వివరాలను టైప్ చేయండి.'
            : 'Speak in Telugu or English, or type the details in your own words.'}
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 ${
          within72Hours
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-amber-300 bg-amber-50'
        }`}
      >
        <div>
          <p
            className={`text-xs font-extrabold uppercase tracking-wider ${
              within72Hours ? 'text-emerald-800' : 'text-amber-900'
            }`}
          >
            {within72Hours
              ? language === 'te'
                ? '72 గంటల నివేదన గడువు · చర్య తీసుకోండి'
                : 'Within 72h Window · Actionable'
              : language === 'te'
                ? '72 గంటల గడువు ముగిసింది · ఆధారాలతో నివేదించండి'
                : 'Past 72h Window · Document & Escalate with Proof'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {incidentDate
              ? language === 'te'
                ? `సంఘటన తేదీ ${incidentDate} ఆధారంగా అంచనా`
                : `Estimate based on incident date ${incidentDate}`
              : language === 'te'
                ? 'సంఘటన తేదీ ఇవ్వలేదు; ఇప్పటి సమయం నుంచి తాత్కాలిక కౌంట్‌డౌన్.'
                : 'No incident date yet; provisional countdown starts from now.'}
            {language === 'te'
              ? ' ఖచ్చితమైన సంఘటన సమయం నమోదు కాలేదు.'
              : ' Exact incident time is not recorded.'}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4 sm:mt-0">
          <div>
            <p className="text-xs font-bold uppercase text-slate-600">
              {language === 'te' ? 'మిగిలిన సమయం' : 'Time remaining'}
            </p>
            <p className="font-mono text-3xl font-black tabular-nums text-slate-950">
              {countdown}
            </p>
          </div>
          <label className="text-xs font-bold text-slate-700">
            {language === 'te' ? 'సంఘటన తేదీ' : 'Incident date'}
            <input
              type="date"
              value={incidentDate}
              onChange={(event) =>
                onDraftFieldChange('incident_date', event.target.value)
              }
              className="mt-1 block min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-900"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              {language === 'te' ? 'మీ సహాయకుడి ప్రశ్న' : 'Your assistant asks'}
            </p>
            <p className="mt-2 text-xl font-semibold leading-relaxed text-slate-900 sm:text-2xl">
              {question}
            </p>
          </div>
          <button
            type="button"
            onClick={() => speak(question, language === 'te' ? 'te-IN' : 'en-IN')}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <Volume2 size={18} aria-hidden="true" />
            {copy.actions.readAloud}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <button
            type="button"
            aria-label={isListening ? copy.actions.stop : copy.actions.startSpeaking}
            aria-pressed={isListening}
            onClick={() =>
              isListening
                ? stopListening()
                : startListening(language === 'te' ? 'te-IN' : 'en-IN')
            }
            className={`flex size-28 items-center justify-center rounded-full text-white shadow-lg transition focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {isListening ? (
              <MicOff size={42} aria-hidden="true" />
            ) : (
              <Mic size={42} aria-hidden="true" />
            )}
          </button>
          <p className="mt-4 text-lg font-bold text-slate-900">
            {isListening ? copy.actions.stop : copy.actions.startSpeaking}
          </p>
          <div
            role={speechError ? 'alert' : 'status'}
            aria-live="polite"
            className="mt-3 w-full space-y-2 text-sm"
          >
            <p className="font-semibold text-slate-700">{speechStatusText}</p>
            {interimTranscript && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-amber-950">
                <span className="font-bold">
                  {language === 'te' ? 'గుర్తిస్తున్నాం: ' : 'Hearing: '}
                </span>
                {interimTranscript}
              </p>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                <span>
                  {language === 'te' ? 'మైక్రోఫోన్ ఇన్‌పుట్ స్థాయి' : 'Microphone input level'}
                </span>
                <span>
                  {isCheckingAudioInput
                    ? language === 'te'
                      ? 'పరికరాన్ని తనిఖీ చేస్తోంది…'
                      : 'Checking device…'
                    : isAudioInputReady
                      ? language === 'te'
                        ? 'మైక్ కనెక్ట్ అయింది'
                        : 'Mic connected'
                      : language === 'te'
                        ? 'మైక్ తనిఖీ కాలేదు'
                        : 'Mic not checked'}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={language === 'te' ? 'మైక్రోఫోన్ ఇన్‌పుట్ స్థాయి' : 'Microphone input level'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(inputLevel * 100)}
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-100"
                  style={{ width: `${Math.round(inputLevel * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {isAudioInputReady
                  ? language === 'te'
                    ? 'మాట్లాడినప్పుడు స్థాయి కదలాలి. స్థాయి కదలకపోతే Windowsలో సరైన మైక్‌ను ఎంచుకుని అనుమతి ఇవ్వండి.'
                    : 'The bar should move while you speak. If it stays still, select the correct Windows microphone and allow access.'
                  : language === 'te'
                    ? 'రికార్డింగ్ ప్రారంభించినప్పుడు మైక్ అనుమతి మరియు పరికరాన్ని తనిఖీ చేస్తాం.'
                    : 'Microphone permission and device are checked when recording starts.'}
              </p>
              {audioInputError && (
                <p className="mt-2 text-xs font-semibold text-rose-700">
                  {audioInputError}
                </p>
              )}
            </div>
            {speechError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left font-semibold text-rose-800">
                {speechError.includes('GEMINI_API_KEY') && language === 'te'
                  ? 'సర్వర్ ఆడియో ట్రాన్స్‌క్రిప్షన్‌కు GEMINI_API_KEY అవసరం. బ్రౌజర్ వాయిస్ గుర్తింపును మళ్లీ ప్రయత్నించండి లేదా వివరాలను టైప్ చేయండి.'
                  : speechError}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label
            htmlFor="incident-transcript"
            className="text-sm font-bold text-slate-800"
          >
            {language === 'te' ? 'మీరు చెప్పిన వివరాలు' : 'Your incident description'}
          </label>
          <textarea
            id="incident-transcript"
            value={transcript}
            onChange={(event) => updateTranscript(event.target.value)}
            rows={5}
            placeholder={
              language === 'te'
                ? 'ఉదాహరణ: నిన్న భారీ వర్షానికి నా వరి పంట మునిగిపోయింది...'
                : 'Example: Heavy rain flooded my paddy field yesterday...'
            }
            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />
          <p className="mt-2 text-xs text-slate-500">
            {language === 'te'
              ? 'మీరు టైప్ చేసి లేదా సవరించి కొనసాగవచ్చు.'
              : 'You can type or edit the transcript before continuing.'}
          </p>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <VisualTapSelector
          kind="crop"
          value={caseData.crop}
          language={language}
          onSelect={(value) => onDraftFieldChange('crop', value)}
        />
        <VisualTapSelector
          kind="calamity"
          value={caseData.calamity_type}
          language={language}
          onSelect={(value) => onDraftFieldChange('calamity_type', value)}
        />
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Sparkles size={17} className="text-amber-600" aria-hidden="true" />
          {language === 'te'
            ? 'త్వరిత నమూనా సంఘటనలు (ఒక-క్లిక్ పరీక్ష)'
            : 'Quick Sample Scenarios (1-Click Test)'}
        </div>
        <p className="mt-1 text-xs text-slate-600">
          {language === 'te'
            ? 'నమూనా వాక్యం నింపి పంట/విపత్తును ఎంచుకుని వివరాలను స్వయంచాలకంగా గుర్తిస్తుంది.'
            : 'Each sample fills the description, selects crop/loss type, and extracts the details automatically.'}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {quickScenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              disabled={isExtracting}
              onClick={() => void applyQuickScenario(scenario)}
              className="min-h-12 rounded-xl border border-amber-300 bg-white px-3 py-2 text-left text-sm font-bold text-emerald-950 transition hover:border-emerald-500 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              {language === 'te' ? scenario.titleTe : scenario.titleEn}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      {capturedFields.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h3 className="font-bold text-slate-900">
            {language === 'te' ? 'గుర్తించిన వివరాలు' : 'Captured details'}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {capturedFields.map((field) => (
              <span
                key={field.label}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <span className="font-semibold">{field.label}:</span> {field.value}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col justify-end gap-3 sm:flex-row">
        <button
          type="button"
          disabled={!transcript.trim() || isExtracting}
          onClick={() => void extractDetails()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isExtracting ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
          {language === 'te' ? 'వివరాలను గుర్తించండి' : 'Extract Details'}
        </button>
        <button
          type="button"
          disabled={!hasExtracted && capturedFields.length === 0}
          onClick={onContinue}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-700 px-5 py-3 font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
        >
          {language === 'te' ? 'నిర్ధారణకు కొనసాగండి' : 'Continue to Confirmation'}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
