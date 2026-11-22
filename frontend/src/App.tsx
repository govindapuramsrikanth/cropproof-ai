import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
} from 'lucide-react'

import { HeroFarmBanner, LiveTelemetryBanner } from './components/AgrarianVisuals'
import { ConfirmationCard } from './components/ConfirmationCard'
import { EvidenceCoach } from './components/EvidenceCoach'
import { PolicyGuidance } from './components/PolicyGuidance'
import { ReportStep } from './components/ReportStep'
import { StoryTrustCenter } from './components/StoryTrustCenter'
import { VoiceIntake } from './components/VoiceIntake'
import { labels, type Language } from './i18n/labels'
import { apiRequest, jsonRequest } from './lib/api'
import type {
  FarmerStory,
  GuidanceResponse,
  IncidentCase,
} from './types'

interface ExtractResponse extends IncidentCase {
  ai_mode: string
  next_question_en: string | null
  next_question_te: string | null
}

function App() {
  const [language, setLanguage] = useState<Language>('te')
  const [caseData, setCaseData] = useState<IncidentCase | null>(null)
  const [stories, setStories] = useState<FarmerStory[]>([])
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null)
  const [activeStep, setActiveStep] = useState(1)
  const [transcript, setTranscript] = useState('')
  const [nextQuestionEn, setNextQuestionEn] = useState<string | null>(null)
  const [nextQuestionTe, setNextQuestionTe] = useState<string | null>(null)
  const [isCreatingCase, setIsCreatingCase] = useState(true)
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false)
  const [appError, setAppError] = useState<string | null>(null)
  const [demoCaseNotice, setDemoCaseNotice] = useState<string | null>(null)
  const startedRef = useRef(false)
  const copy = labels[language]

  const loadGuidance = useCallback(async (caseId: string) => {
    setIsLoadingGuidance(true)
    setAppError(null)
    try {
      const result = await apiRequest<GuidanceResponse>(
        `/api/cases/${caseId}/guidance`,
      )
      setGuidance(result)
    } catch (reason) {
      setAppError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load policy guidance.',
      )
    } finally {
      setIsLoadingGuidance(false)
    }
  }, [])

  const createCase = useCallback(
    async (demo: boolean) => {
      setIsCreatingCase(true)
      setAppError(null)
      setDemoCaseNotice(null)
      try {
        const newCase = await apiRequest<IncidentCase>(
          '/api/cases',
          jsonRequest('POST', { demo, language }),
        )
        setCaseData(newCase)
        setGuidance(null)
        setTranscript('')
        setNextQuestionEn(null)
        setNextQuestionTe(null)
        setActiveStep(demo ? 3 : 1)
        if (demo) {
          setDemoCaseNotice(
            'Demo Case Loaded: Miryalaguda, Nalgonda — 2.5 Acres Paddy Flood',
          )
          await loadGuidance(newCase.id)
        }
        if (stories.length === 0) {
          try {
            setStories(await apiRequest<FarmerStory[]>('/api/stories'))
          } catch (reason) {
            setAppError(
              reason instanceof Error
                ? `Case started, but public stories could not be loaded: ${reason.message}`
                : 'Case started, but public stories could not be loaded.',
            )
          }
        }
      } catch (reason) {
        setAppError(
          reason instanceof Error ? reason.message : 'Unable to start a case.',
        )
      } finally {
        setIsCreatingCase(false)
      }
    },
    [language, loadGuidance, stories.length],
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void createCase(false)
  }, [createCase])

  const goToStep = useCallback(
    (step: number) => {
      setActiveStep(step)
      if (step >= 3 && caseData) void loadGuidance(caseData.id)
    },
    [caseData, loadGuidance],
  )

  const handleExtracted = (result: ExtractResponse) => {
    const {
      ai_mode: _aiMode,
      next_question_en: questionEn,
      next_question_te: questionTe,
      ...updatedCase
    } = result
    setCaseData((current) =>
      current
        ? {
            ...current,
            ...updatedCase,
            crop: updatedCase.crop ?? current.crop,
            calamity_type: updatedCase.calamity_type ?? current.calamity_type,
            evidence: current.evidence ?? [],
          }
        : updatedCase,
    )
    setNextQuestionEn(questionEn)
    setNextQuestionTe(questionTe)
  }

  const handleConfirmed = (updatedCase: IncidentCase) => {
    setCaseData(updatedCase)
    setActiveStep(3)
    void loadGuidance(updatedCase.id)
  }

  const refreshCaseAndGuidance = async () => {
    if (!caseData) return
    try {
      const updatedCase = await apiRequest<IncidentCase>(
        `/api/cases/${caseData.id}`,
      )
      setCaseData(updatedCase)
      await loadGuidance(updatedCase.id)
    } catch (reason) {
      setAppError(
        reason instanceof Error
          ? reason.message
          : 'Unable to refresh case information.',
      )
    }
  }

  const handleStatusUpdated = (updatedCase: IncidentCase) => {
    setCaseData((current) =>
      current
        ? { ...current, ...updatedCase, evidence: current.evidence ?? [] }
        : updatedCase,
    )
  }

  const handleDraftFieldChange = (
    field: 'crop' | 'calamity_type' | 'incident_date',
    value: string,
  ) => {
    setCaseData((current) =>
      current
        ? { ...current, [field]: field === 'incident_date' && !value ? null : value }
        : current,
    )
  }

  const handleHeroStartIntake = () => {
    setActiveStep(1)
    window.requestAnimationFrame(() => {
      document
        .getElementById('voice-intake-title')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const steps = [
    copy.steps.voiceTextIntake,
    copy.steps.confirmDetails,
    copy.steps.policyFarmerStories,
    copy.steps.evidenceUpload,
    copy.steps.readinessPdf,
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <HeroFarmBanner
        language={language}
        onLanguageChange={setLanguage}
        onLoadDemo={() => void createCase(true)}
        isLoadingDemo={isCreatingCase}
        onStartIntake={handleHeroStartIntake}
      />
      <LiveTelemetryBanner
        caseData={caseData}
        language={language}
        onUpdated={(updatedCase) => setCaseData(updatedCase)}
      />

      <main className="mx-auto max-w-[1440px] px-4 pb-14 pt-6 sm:px-7 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {language === 'te'
              ? 'ప్రతి దశలో మీకు అవసరమైన వివరాలను జోడించండి.'
              : 'Add the information you have at each step.'}
          </p>
          {caseData && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-600">
              Case ID · {caseData.id.slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>

        <nav aria-label="Case preparation steps" className="mb-8">
          <ol className="flex snap-x gap-2 overflow-x-auto pb-2">
            {steps.map((step, index) => {
              const stepNumber = index + 1
              const isCurrent = activeStep === stepNumber
              const isComplete = stepNumber < activeStep
              return (
                <li key={step} className="min-w-44 flex-1 snap-start">
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => goToStep(stepNumber)}
                    className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                      isCurrent
                        ? 'border-emerald-700 bg-emerald-50 shadow-sm'
                        : isComplete
                          ? 'border-emerald-200 bg-white hover:bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                        isCurrent
                          ? 'bg-emerald-700 text-white'
                          : isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isComplete ? <Check size={18} aria-hidden="true" /> : stepNumber}
                    </span>
                    <span
                      className={`text-sm font-bold leading-snug ${
                        isCurrent ? 'text-emerald-950' : 'text-slate-700'
                      }`}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {appError && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          >
            <span>{appError}</span>
            {!caseData && (
              <button
                type="button"
                onClick={() => void createCase(false)}
                className="min-h-9 rounded-lg border border-rose-300 bg-white px-3 font-bold hover:bg-rose-100"
              >
                {language === 'te' ? 'మళ్లీ ప్రయత్నించండి' : 'Retry'}
              </button>
            )}
          </div>
        )}

        {demoCaseNotice && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 shadow-sm"
          >
            <Check size={20} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p>{demoCaseNotice}</p>
          </div>
        )}

        {isCreatingCase && !caseData ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center">
            <span className="size-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
            <p className="mt-4 font-semibold text-slate-700">
              {language === 'te' ? 'మీ కేసును సిద్ధం చేస్తున్నాం…' : 'Preparing your case…'}
            </p>
          </div>
        ) : caseData ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
            {activeStep === 1 && (
              <VoiceIntake
                caseData={caseData}
                language={language}
                transcript={transcript}
                onTranscriptChange={setTranscript}
                nextQuestionEn={nextQuestionEn}
                nextQuestionTe={nextQuestionTe}
                onExtracted={handleExtracted}
                onDraftFieldChange={handleDraftFieldChange}
                onContinue={() => goToStep(2)}
              />
            )}
            {activeStep === 2 && (
              <ConfirmationCard
                caseData={caseData}
                language={language}
                onConfirmed={handleConfirmed}
              />
            )}
            {activeStep === 3 && (
              <>
                <PolicyGuidance
                  caseData={caseData}
                  guidance={guidance}
                  language={language}
                  isLoading={isLoadingGuidance}
                />
                <StoryTrustCenter
                  caseData={caseData}
                  language={language}
                  matchedStories={guidance?.matched_stories ?? []}
                  publicStories={stories}
                  transcript={transcript}
                />
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToStep(4)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800"
                  >
                    {language === 'te' ? 'ఆధారాల అప్‌లోడ్‌కు కొనసాగండి' : 'Continue to Evidence Upload'}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {activeStep === 4 && (
              <>
                <EvidenceCoach
                  caseData={caseData}
                  guidance={guidance}
                  language={language}
                  onUploaded={() => void refreshCaseAndGuidance()}
                />
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={() => goToStep(5)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800"
                  >
                    {language === 'te' ? 'సిద్ధత PDFకు కొనసాగండి' : 'Continue to Readiness PDF'}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
            {activeStep === 5 && (
              <ReportStep
                caseData={caseData}
                guidance={guidance}
                language={language}
                onCaseUpdated={handleStatusUpdated}
              />
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App
