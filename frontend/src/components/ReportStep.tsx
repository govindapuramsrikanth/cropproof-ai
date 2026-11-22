import { useEffect, useState, type FormEvent } from 'react'
import {
  Check,
  CloudRain,
  Copy,
  Download,
  FileCheck2,
  Info,
  Images,
  MapPin,
  MessageCircle,
  Save,
} from 'lucide-react'

import { labels, type Language } from '../i18n/labels'
import { apiRequest, apiUrl, jsonRequest } from '../lib/api'
import type {
  DossierIntegrity,
  GuidanceResponse,
  IncidentCase,
} from '../types'

interface ReportStepProps {
  caseData: IncidentCase
  guidance: GuidanceResponse | null
  language: Language
  onCaseUpdated: (caseData: IncidentCase) => void
}

const followUpStatuses = [
  'Preparing Evidence',
  'Reported via 14447 / App',
  'Field Survey Scheduled',
]

function evidenceUrl(caseId: string, filePath: string, fileName: string): string {
  const storedName = filePath.split(/[\\/]/).pop() || fileName
  return apiUrl(
    `/uploads/${encodeURIComponent(caseId)}/${encodeURIComponent(storedName)}`,
  )
}

function isImage(fileName: string): boolean {
  return /\.(jpe?g|jfif|png|webp|gif)$/i.test(fileName)
}

export function ReportStep({
  caseData,
  guidance,
  language,
  onCaseUpdated,
}: ReportStepProps) {
  const [manualStatus, setManualStatus] = useState(caseData.manual_status ?? '')
  const [acknowledgementRef, setAcknowledgementRef] = useState(
    caseData.acknowledgement_ref ?? '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [integrityState, setIntegrityState] = useState<{
    caseId: string
    status: 'loading' | 'loaded' | 'error'
    data: DossierIntegrity | null
    error: string | null
  }>(() => ({
    caseId: caseData.id,
    status: 'loading',
    data: null,
    error: null,
  }))
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void apiRequest<DossierIntegrity>(
      `/api/cases/${caseData.id}/dossier-integrity`,
    )
      .then((result) => {
        if (active) {
          setIntegrityState({
            caseId: caseData.id,
            status: 'loaded',
            data: result,
            error: null,
          })
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setIntegrityState({
            caseId: caseData.id,
            status: 'error',
            data: null,
            error:
              reason instanceof Error
                ? reason.message
                : 'Unable to load the dossier integrity stamp.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [caseData.id])
  const isLoadingIntegrity =
    integrityState.caseId !== caseData.id || integrityState.status === 'loading'
  const dossierIntegrity =
    integrityState.caseId === caseData.id ? integrityState.data : null
  const integrityError =
    integrityState.caseId === caseData.id ? integrityState.error : null

  const missingFields =
    guidance?.missing_info.fields ?? guidance?.missing_fields ?? []
  const missingEvidence =
    guidance?.missing_info.evidence ?? guidance?.missing_evidence ?? []
  const checklistCount = missingFields.length + missingEvidence.length
  const copy = labels[language]
  const images = (caseData.evidence ?? []).filter((item) =>
    isImage(item.file_name),
  )
  const extraEvidenceCount = Math.max(0, (caseData.evidence?.length ?? 0) - 4)
  const unknown = language === 'te' ? 'ఇంకా నమోదు కాలేదు' : 'Not provided'
  const incidentPlace = [caseData.village, caseData.district, caseData.state]
    .filter(Boolean)
    .join(', ')
  const rainfallSourceLabel =
    dossierIntegrity?.rainfall_source === 'open-meteo'
      ? 'Open-Meteo'
      : dossierIntegrity?.rainfall_source === 'demo_seed'
        ? language === 'te'
          ? 'డెమో డేటా (ప్రత్యక్షం కాదు)'
          : 'Demo seed (not live-verified)'
        : dossierIntegrity?.rainfall_source === 'fallback_cache'
          ? language === 'te'
            ? 'ఆఫ్‌లైన్ అంచనా'
            : 'Offline fallback estimate'
          : language === 'te'
            ? 'తెలియదు'
            : 'Unknown'
  const reportingStatusText =
    dossierIntegrity?.reporting_status === 'within_72h_window'
      ? language === 'te'
        ? '72 గంటల గడువులో ఉంది (తేదీ ఆధారిత అంచనా)'
        : 'Within 72-hour window (date-based estimate)'
      : dossierIntegrity?.reporting_status === 'past_72h_window'
        ? language === 'te'
          ? '72 గంటల గడువు దాటింది — ఆధారాలతో సమీక్ష కోరండి'
          : 'Past 72-hour window — document and request review'
        : language === 'te'
          ? 'సంఘటన తేదీ అందుబాటులో లేదు'
          : 'Incident date unavailable'

  const claimSummary = [
    language === 'te'
      ? 'CropProof AI సిద్ధత డోసియర్'
      : 'CropProof AI claim readiness dossier',
    `Dossier ID: ${dossierIntegrity?.dossier_id ?? 'Pending'}`,
    `Claim ID: ${caseData.id}`,
    `${language === 'te' ? 'రైతు' : 'Farmer'}: ${caseData.farmer_alias ?? unknown}`,
    `${language === 'te' ? 'స్థలం' : 'Location'}: ${incidentPlace || unknown}`,
    `${language === 'te' ? 'పంట' : 'Crop'}: ${caseData.crop ?? unknown}`,
    `${language === 'te' ? 'విపత్తు' : 'Calamity'}: ${caseData.calamity_type ?? unknown}`,
    `${language === 'te' ? 'సంఘటన తేదీ' : 'Incident date'}: ${caseData.incident_date ?? unknown}`,
    `${language === 'te' ? 'విస్తీర్ణం' : 'Affected area'}: ${
      caseData.affected_area_acres === null
        ? unknown
        : `${caseData.affected_area_acres} acres`
    }`,
    `${language === 'te' ? 'వర్షపాతం' : 'Rainfall'}: ${
      dossierIntegrity?.rainfall_mm === null ||
      dossierIntegrity?.rainfall_mm === undefined
        ? unknown
        : `${dossierIntegrity.rainfall_mm.toFixed(1)} mm (${rainfallSourceLabel})`
    }`,
    `${language === 'te' ? 'నివేదన గడువు' : 'Reporting window'}: ${reportingStatusText}`,
    `SHA-256: ${dossierIntegrity?.sha256_hash ?? 'Pending'}`,
  ].join('\n')

  const copyClaimSummary = async () => {
    try {
      await navigator.clipboard.writeText(claimSummary)
      setShareStatus(
        language === 'te' ? 'సారాంశం కాపీ చేయబడింది.' : 'Summary copied.',
      )
    } catch (reason) {
      setShareStatus(
        reason instanceof Error
          ? reason.message
          : language === 'te'
            ? 'సారాంశాన్ని కాపీ చేయలేకపోయాం.'
            : 'Unable to copy the summary.',
      )
    }
  }

  const saveFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updatedCase = await apiRequest<IncidentCase>(
        `/api/cases/${caseData.id}/status`,
        jsonRequest('PATCH', {
          manual_status: manualStatus || null,
          acknowledgement_ref: acknowledgementRef || null,
        }),
      )
      onCaseUpdated(updatedCase)
      setSaved(true)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save follow-up.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="report-step-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {language === 'te' ? 'దశ 5 · సిద్ధత PDF' : 'Step 5 · Readiness PDF'}
        </p>
        <h2
          id="report-step-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {language === 'te' ? 'మీ సిద్ధత నివేదికను రూపొందించండి' : 'Your readiness dossier'}
        </h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          {language === 'te'
            ? 'ఈ నివేదిక మీ వివరాలు, ఆధారాలు, లోటులు మరియు అధికారిక సూచనలను సమీకరిస్తుంది. ఇది క్లెయిమ్ కాదు.'
            : 'The dossier brings together your details, evidence, missing items, and official references. It is not a claim submission.'}
        </p>
      </div>

      <section
        aria-labelledby="dossier-preview-title"
        className="overflow-hidden rounded-3xl border-2 border-emerald-800 bg-white shadow-lg shadow-emerald-950/10"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#14532d] px-5 py-5 text-white sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[#f59e0b] text-emerald-950">
              <FileCheck2 size={23} aria-hidden="true" />
            </span>
            <div>
              <h3 id="dossier-preview-title" className="text-xl font-extrabold">
                {language === 'te' ? 'ప్రత్యక్ష డోసియర్ ప్రివ్యూ' : 'Live Dossier Preview'}
              </h3>
              <p className="mt-1 text-sm text-emerald-100">
                {caseData.is_confirmed
                  ? language === 'te'
                    ? 'రైతు నిర్ధారించిన వివరాలు'
                    : 'Farmer-confirmed details'
                  : language === 'te'
                    ? 'ఇంకా నిర్ధారించని ముసాయిదా'
                    : 'Unconfirmed draft'}
              </p>
            </div>
          </div>
          <a
            href={apiUrl(`/api/cases/${caseData.id}/report.pdf`)}
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#f59e0b] px-5 py-3 text-center text-base font-extrabold text-[#17220f] shadow-sm transition hover:bg-amber-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-200 sm:text-lg"
          >
            <Download size={21} aria-hidden="true" />
            {language === 'te'
              ? 'క్లెయిమ్ సిద్ధత PDF డౌన్‌లోడ్ చేయండి'
              : 'Download Claim Readiness PDF'}
          </a>
        </div>

        <div className="border-b border-amber-200 bg-amber-50/70 px-5 py-4 sm:px-7">
          {isLoadingIntegrity ? (
            <p className="text-sm font-semibold text-amber-950">
              {language === 'te'
                ? 'డోసియర్ సమగ్రత ముద్రను సిద్ధం చేస్తున్నాం…'
                : 'Preparing the dossier integrity stamp…'}
            </p>
          ) : integrityError ? (
            <p role="alert" className="text-sm font-semibold text-rose-800">
              {integrityError}
            </p>
          ) : dossierIntegrity ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                    {language === 'te' ? 'డోసియర్ ID' : 'Dossier ID'}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-bold text-slate-950">
                    {dossierIntegrity.dossier_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                    {language === 'te' ? 'తయారు చేసిన సమయం' : 'Generated at'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {new Date(dossierIntegrity.generated_at).toLocaleString(
                      language === 'te' ? 'te-IN' : 'en-IN',
                      { timeZone: 'Asia/Kolkata' },
                    )}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-amber-900">
                  SHA-256 {language === 'te' ? 'సమగ్రత హాష్' : 'Integrity Hash'}
                </p>
                <p className="mt-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs font-semibold leading-relaxed text-slate-900 sm:text-sm">
                  {dossierIntegrity.sha256_hash}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-white px-3 py-1.5 text-slate-800">
                  {language === 'te' ? 'వర్షపాతం మూలం' : 'Rainfall source'}: {rainfallSourceLabel}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 ${
                    dossierIntegrity.within_72h_window === true
                      ? 'bg-emerald-100 text-emerald-900'
                      : dossierIntegrity.within_72h_window === false
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {reportingStatusText}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [language === 'te' ? 'పంట' : 'Crop', caseData.crop],
                [
                  language === 'te' ? 'విపత్తు' : 'Calamity',
                  caseData.calamity_type?.replaceAll('_', ' '),
                ],
                [
                  language === 'te' ? 'సంఘటన తేదీ' : 'Incident date',
                  caseData.incident_date,
                ],
                [
                  language === 'te' ? 'గ్రామం / జిల్లా / రాష్ట్రం' : 'Village / District / State',
                  incidentPlace,
                ],
                [
                  language === 'te' ? 'నష్టపోయిన విస్తీర్ణం' : 'Affected area',
                  caseData.affected_area_acres === null
                    ? null
                    : `${caseData.affected_area_acres} acres`,
                ],
                [
                  language === 'te' ? 'బీమా స్థితి' : 'Insurance status',
                  caseData.insurance_status?.replaceAll('_', ' '),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 break-words font-bold text-slate-900">
                    {value || unknown}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-emerald-900">
                  <MapPin size={16} aria-hidden="true" />
                  {copy.telemetry.gpsCoordinates}
                </p>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-emerald-950">
                  {caseData.gps_lat === null || caseData.gps_lon === null
                    ? copy.telemetry.unavailable
                    : `${caseData.gps_lat.toFixed(5)}, ${caseData.gps_lon.toFixed(5)}`}
                </p>
                <p className="mt-1 text-xs text-emerald-800">
                  {copy.telemetry.accuracy}:{' '}
                  {caseData.gps_accuracy_m === null
                    ? copy.telemetry.unavailable
                    : `±${caseData.gps_accuracy_m.toFixed(1)} m`}
                </p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-sky-900">
                  <CloudRain size={17} aria-hidden="true" />
                  {copy.telemetry.rainfall72h}
                </p>
                <p className="mt-2 font-mono text-2xl font-black tabular-nums text-sky-950">
                  {caseData.rainfall_mm_72h === null
                    ? copy.telemetry.unavailable
                    : `${caseData.rainfall_mm_72h.toFixed(1)} mm`}
                </p>
                <p className="mt-1 text-xs text-sky-800">
                  {caseData.weather_observed_at
                    ? `${copy.telemetry.observedAt}: ${new Date(
                        caseData.weather_observed_at,
                      ).toLocaleString(language === 'te' ? 'te-IN' : 'en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}`
                    : copy.telemetry.unavailable}
                </p>
              </div>
            </div>
            {caseData.weather_summary && (
              <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                <span className="font-bold">
                  {copy.telemetry.currentWeather}:{' '}
                </span>
                {caseData.weather_summary}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-extrabold text-slate-900">
              <Images size={18} className="text-emerald-800" aria-hidden="true" />
              {language === 'te' ? 'అప్‌లోడ్ చేసిన ఫోటోలు' : 'Uploaded photo evidence'}
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
                {images.length}
              </span>
            </h4>
            {images.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {images.slice(0, 4).map((item) => (
                  <a
                    key={item.id}
                    href={evidenceUrl(caseData.id, item.file_path, item.file_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <img
                      src={evidenceUrl(caseData.id, item.file_path, item.file_name)}
                      alt={item.farmer_caption || item.file_name}
                      className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="block truncate px-2.5 py-2 text-xs font-semibold text-slate-700">
                      {item.farmer_caption || item.file_name}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <Images size={27} className="text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {language === 'te'
                    ? 'ఇంకా ఫోటో ఆధారాలు అప్‌లోడ్ కాలేదు'
                    : 'No photo evidence uploaded yet'}
                </p>
              </div>
            )}
            {extraEvidenceCount > 0 && (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {language === 'te'
                  ? `మరియు ${extraEvidenceCount} ఇతర ఆధారాలు`
                  : `and ${extraEvidenceCount} more evidence files`}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-extrabold text-emerald-950">
            {language === 'te'
              ? '72 గంటల తదుపరి చర్యల చెక్‌లిస్ట్'
              : '72-Hour Next Steps Checklist'}
          </h3>
          <p className="mt-1 text-sm text-emerald-900">
            {reportingStatusText}
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-800">
            <li className="flex gap-2">
              <Check size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                {dossierIntegrity?.within_72h_window === false
                  ? language === 'te'
                    ? 'వెంటనే నివేదించి, ఆలస్యానికి సంబంధించిన ఆధారాలతో సమర్థ అధికారుల సమీక్షను కోరండి.'
                    : 'If past 72 hours, report promptly and request competent-authority review with supporting proof.'
                  : language === 'te'
                    ? '72 గంటల్లో PMFBY/బీమా సంస్థకు నివేదించండి; అవసరమైతే బ్యాంక్, CSC లేదా వ్యవసాయ అధికారిని సంప్రదించండి.'
                    : 'Report within 72 hours via PMFBY/insurer; contact your bank, CSC, or Agriculture Officer as applicable.'}
              </span>
            </li>
            <li className="flex gap-2">
              <Check size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                {language === 'te'
                  ? 'తేదీ ఉన్న పొలం ఫోటోలు, పాస్‌బుక్ మరియు పాలసీ వివరాలు సిద్ధంగా ఉంచండి.'
                  : 'Keep dated field photos, passbook, and policy details ready.'}
              </span>
            </li>
            <li className="flex gap-2">
              <Check size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                {language === 'te'
                  ? 'అధికారిక డాకెట్ / అంగీకార సంఖ్యను అడిగి రాసుకోండి.'
                  : 'Ask for and record the official docket / acknowledgement number.'}
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-extrabold text-slate-950">
            {language === 'te' ? 'క్లెయిమ్ సారాంశాన్ని పంచుకోండి' : 'Share Claim Summary'}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {language === 'te'
              ? 'పంపేముందు వ్యక్తిగత వివరాలను సమీక్షించండి. ఇది అధికారిక క్లెయిమ్ సమర్పణ కాదు.'
              : 'Review personal details before sharing. This is not an official claim submission.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!dossierIntegrity}
              onClick={() => void copyClaimSummary()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-800 bg-white px-4 py-2 font-bold text-sky-900 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-50"
            >
              <Copy size={17} aria-hidden="true" />
              {language === 'te' ? 'సారాంశాన్ని కాపీ చేయండి' : 'Copy Summary'}
            </button>
            <a
              href={
                dossierIntegrity
                  ? `https://wa.me/?text=${encodeURIComponent(claimSummary)}`
                  : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!dossierIntegrity}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2 font-bold text-white transition hover:bg-[#0f766e] ${
                dossierIntegrity ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <MessageCircle size={17} aria-hidden="true" />
              {language === 'te' ? 'WhatsAppలో పంచుకోండి' : 'WhatsApp Share'}
            </a>
          </div>
          {shareStatus && (
            <p role="status" className="mt-3 text-sm font-semibold text-slate-700">
              {shareStatus}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <FileCheck2 size={23} aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {language === 'te' ? 'తుది సిద్ధత సారాంశం' : 'Final readiness summary'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {language === 'te'
                  ? `సమీక్షించాల్సిన అంశాలు: ${checklistCount}`
                  : `Items still to review: ${checklistCount}`}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {language === 'te' ? 'కేసు' : 'Case'}
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">
                {caseData.id}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {language === 'te' ? 'నిర్ధారణ' : 'Farmer confirmation'}
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {caseData.is_confirmed
                  ? language === 'te'
                    ? 'రైతు నిర్ధారించారు'
                    : 'Confirmed by farmer'
                  : language === 'te'
                    ? 'ఇంకా నిర్ధారించలేదు'
                    : 'Not confirmed yet'}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {language === 'te' ? 'ఇంకా అవసరమైన వివరాలు' : 'Information to review'}
              </h4>
              {missingFields.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {missingFields.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-800">
                  {language === 'te' ? 'అవసరమైన వివరాలు నమోదు అయ్యాయి.' : 'Required details are present.'}
                </p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {language === 'te' ? 'సూచించిన ఆధారాలు' : 'Evidence to consider'}
              </h4>
              {missingEvidence.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {missingEvidence.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-emerald-800">
                  {language === 'te' ? 'సూచించిన ఆధారాలు అప్‌లోడ్ అయ్యాయి.' : 'Suggested evidence is uploaded.'}
                </p>
              )}
            </div>
          </div>

        </section>

        <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-slate-900">
            {language === 'te' ? 'వ్యక్తిగత తదుపరి చర్యల ట్రాకర్' : 'Personal Follow-Up Tracker'}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {language === 'te'
              ? 'ఇది మీ వ్యక్తిగత గమనిక మాత్రమే; అధికారిక క్లెయిమ్ స్థితి కాదు.'
              : 'This is your personal progress note, not an official claim status.'}
          </p>

          <form onSubmit={saveFollowUp} className="mt-5 space-y-4">
            <label
              htmlFor="manual-status"
              className="block text-sm font-semibold text-slate-700"
            >
              {language === 'te' ? 'మీ ప్రస్తుత స్థితి' : 'Your current status'}
              <select
                id="manual-status"
                value={manualStatus}
                onChange={(event) => setManualStatus(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">
                  {language === 'te' ? 'స్థితిని ఎంచుకోండి' : 'Choose a status'}
                </option>
                {followUpStatuses.map((status) => (
                  <option key={status} value={status}>
                    {language === 'te'
                      ? status === 'Preparing Evidence'
                        ? 'ఆధారాలు సిద్ధం చేస్తున్నాను'
                        : status === 'Reported via 14447 / App'
                          ? '14447 / యాప్ ద్వారా నివేదించాను'
                          : 'క్షేత్ర పరిశీలన నిర్ణయించబడింది'
                      : status}
                  </option>
                ))}
              </select>
            </label>

            <label
              htmlFor="acknowledgement-reference"
              className="block text-sm font-semibold text-slate-700"
            >
              {language === 'te'
                ? 'రసీదు / అంగీకార సూచన సంఖ్య'
                : 'Acknowledgement reference number'}
              <input
                id="acknowledgement-reference"
                value={acknowledgementRef}
                onChange={(event) => setAcknowledgementRef(event.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                placeholder={language === 'te' ? 'ఐచ్ఛికం' : 'Optional'}
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-rose-100 p-3 text-sm text-rose-800">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">
                {language === 'te' ? 'వ్యక్తిగత స్థితి సేవ్ చేయబడింది.' : 'Personal follow-up status saved.'}
              </p>
            )}
            <button
              type="submit"
              disabled={!manualStatus || isSaving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-800 bg-white px-4 py-2 font-bold text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} aria-hidden="true" />
              {isSaving
                ? language === 'te'
                  ? 'సేవ్ చేస్తోంది...'
                  : 'Saving...'
                : language === 'te'
                  ? 'నా స్థితిని సేవ్ చేయండి'
                  : 'Save My Status'}
            </button>
          </form>

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {language === 'te'
              ? 'వ్యక్తిగత గుర్తింపు సంఖ్యలు లేదా బ్యాంక్ ఖాతా వివరాలను ఇక్కడ నమోదు చేయవద్దు.'
              : 'Do not enter personal identification numbers or bank account details here.'}
          </p>
        </section>
      </div>
    </section>
  )
}