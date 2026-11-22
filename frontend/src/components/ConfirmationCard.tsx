import { useState, type FormEvent } from 'react'
import { CheckCircle2, CloudRain, MapPin, ShieldAlert } from 'lucide-react'

import { labels, type Language } from '../i18n/labels'
import { VisualTapSelector } from './AgrarianVisuals'
import { apiRequest, jsonRequest } from '../lib/api'
import type {
  CalamityType,
  IncidentCase,
  InsuranceStatus,
  RainfallVerification,
} from '../types'

interface ConfirmationCardProps {
  caseData: IncidentCase
  language: Language
  onConfirmed: (caseData: IncidentCase) => void
}

interface ConfirmationForm {
  farmer_alias: string
  crop: string
  calamity_type: string
  incident_date: string
  village: string
  district: string
  affected_area_acres: string
  crop_stage: string
  insurance_status: string
}

const calamityOptions: { value: CalamityType; en: string; te: string }[] = [
  { value: 'flood_inundation', en: 'Flood / inundation', te: 'వరద / ముంపు' },
  { value: 'hailstorm', en: 'Hailstorm', te: 'వడగళ్ల వర్షం' },
  { value: 'heavy_rain', en: 'Heavy rain', te: 'భారీ వర్షం' },
  { value: 'unseasonal_rain', en: 'Unseasonal / heavy rain', te: 'అకాల / భారీ వర్షం' },
  {
    value: 'post_harvest_rain',
    en: 'Post-harvest rain',
    te: 'కోత తర్వాత వర్షం',
  },
  { value: 'other', en: 'Other', te: 'ఇతర' },
]

const insuranceOptions: { value: InsuranceStatus; en: string; te: string }[] = [
  { value: 'enrolled_loanee', en: 'Enrolled — loan-linked', te: 'రుణంతో బీమా' },
  {
    value: 'enrolled_non_loanee',
    en: 'Enrolled — not loan-linked',
    te: 'రుణం లేకుండా బీమా',
  },
  { value: 'unsure', en: 'Not sure', te: 'తెలియదు' },
  { value: 'not_enrolled', en: 'Not enrolled', te: 'బీమా చేయలేదు' },
]

function toForm(caseData: IncidentCase): ConfirmationForm {
  return {
    farmer_alias: caseData.farmer_alias ?? '',
    crop: caseData.crop ?? '',
    calamity_type: caseData.calamity_type ?? '',
    incident_date: caseData.incident_date ?? '',
    village: caseData.village ?? '',
    district: caseData.district ?? '',
    affected_area_acres:
      caseData.affected_area_acres === null
        ? ''
        : String(caseData.affected_area_acres),
    crop_stage: caseData.crop_stage ?? '',
    insurance_status: caseData.insurance_status ?? '',
  }
}

export function ConfirmationCard({
  caseData,
  language,
  onConfirmed,
}: ConfirmationCardProps) {
  const copy = labels[language]
  const [form, setForm] = useState(() => toForm(caseData))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rainfall, setRainfall] = useState<RainfallVerification | null>(null)
  const [isVerifyingRainfall, setIsVerifyingRainfall] = useState(false)
  const [rainfallError, setRainfallError] = useState<string | null>(null)

  const setField = (field: keyof ConfirmationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const verifyRainfall = async () => {
    setIsVerifyingRainfall(true)
    setRainfallError(null)
    try {
      let latitude = caseData.gps_lat
      let longitude = caseData.gps_lon
      if (latitude === null || longitude === null) {
        if (!navigator.geolocation) {
          throw new Error(
            language === 'te'
              ? 'GPS అందుబాటులో లేదు. పై భాగంలోని Live Proof నియంత్రణను ఉపయోగించండి.'
              : 'GPS is unavailable. Use the Live Proof control above or enable location access.',
          )
        }
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 8000,
            })
          },
        )
        latitude = position.coords.latitude
        longitude = position.coords.longitude
      }

      const parameters = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
      })
      const incidentDate = form.incident_date || caseData.incident_date
      if (incidentDate) {
        parameters.set('incident_date', incidentDate.slice(0, 10))
      }
      const result = await apiRequest<RainfallVerification>(
        `/api/weather/verify?${parameters.toString()}`,
      )
      setRainfall(result)
    } catch (reason) {
      setRainfallError(
        reason instanceof Error
          ? reason.message
          : language === 'te'
            ? 'వర్షపాతం వివరాలను పొందలేకపోయాం.'
            : 'Unable to retrieve rainfall verification.',
      )
    } finally {
      setIsVerifyingRainfall(false)
    }
  }

  const confirmDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const body = {
      ...form,
      affected_area_acres:
        form.affected_area_acres.trim() === ''
          ? null
          : Number(form.affected_area_acres),
    }
    try {
      const updatedCase = await apiRequest<IncidentCase>(
        `/api/cases/${caseData.id}/confirm`,
        jsonRequest('PATCH', body),
      )
      onConfirmed(updatedCase)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to save details.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const fieldClass =
    'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100'
  const labelClass = 'block text-sm font-semibold text-slate-700'

  return (
    <section className="space-y-6" aria-labelledby="confirm-details-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          Step 2 · {copy.steps.confirmDetails}
        </p>
        <h2
          id="confirm-details-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {language === 'te' ? 'వివరాలను పరిశీలించండి' : 'Review your incident details'}
        </h2>
        <p className="mt-2 text-slate-600">
          {language === 'te'
            ? 'తప్పుగా ఉన్న వివరాలను సరిచేసి, మీకు తెలిసిన వాటిని మాత్రమే నిర్ధారించండి.'
            : 'Correct anything that is wrong and confirm only the details you know.'}
        </p>
      </div>

      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
      >
        <ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={20} aria-hidden="true" />
        <p className="font-semibold">
          <span className="block">{copy.unconfirmedDraftTitle}</span>
          <span className="mt-0.5 block text-sm font-medium">
            {copy.unconfirmedDraftMessage}
          </span>
        </p>
      </div>

      <section
        aria-labelledby="rainfall-verification-title"
        className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 bg-sky-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-sky-700 text-white">
              <CloudRain size={22} aria-hidden="true" />
            </span>
            <div>
              <h3
                id="rainfall-verification-title"
                className="font-extrabold text-slate-950"
              >
                {language === 'te'
                  ? 'వర్షపాతం & 72 గంటల ధృవీకరణ'
                  : 'Rainfall & 72-Hour Verification'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {language === 'te'
                  ? 'సంఘటన తేదీ మరియు GPS స్థానం కోసం రోజువారీ వర్షపాతాన్ని తనిఖీ చేయండి.'
                  : 'Check daily precipitation for the incident date and GPS location.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isVerifyingRainfall}
            onClick={() => void verifyRainfall()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-800 px-4 py-2 font-bold text-white transition hover:bg-sky-900 disabled:cursor-wait disabled:opacity-60"
          >
            {isVerifyingRainfall && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {isVerifyingRainfall
              ? language === 'te'
                ? 'తనిఖీ చేస్తోంది…'
                : 'Checking…'
              : language === 'te'
                ? 'వర్షపాతాన్ని ధృవీకరించండి'
                : 'Verify Rainfall'}
          </button>
        </div>

        {rainfallError && (
          <p
            role="alert"
            className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800"
          >
            {rainfallError}
          </p>
        )}

        {rainfall && (
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${
                  rainfall.source === 'open-meteo'
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-amber-100 text-amber-950'
                }`}
              >
                {rainfall.source === 'open-meteo'
                  ? 'Open-Meteo Verified'
                  : 'Offline / Fallback Data'}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  rainfall.within_72h_window
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-rose-50 text-rose-800'
                }`}
              >
                {rainfall.within_72h_window
                  ? language === 'te'
                    ? '72 గంటల గడువులో ఉంది'
                    : 'Within 72h window'
                  : language === 'te'
                    ? '72 గంటల గడువు దాటింది'
                    : 'Past 72h window'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-900">
                  {language === 'te' ? 'రోజువారీ వర్షపాతం' : 'Daily rainfall'}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {rainfall.precipitation_mm.toFixed(1)} mm
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  <MapPin className="mr-1 inline" size={14} aria-hidden="true" />
                  {language === 'te' ? 'అక్షాంశం, రేఖాంశం' : 'Coordinates'}
                </p>
                <p className="mt-1 font-mono text-sm font-bold text-slate-950">
                  {rainfall.latitude.toFixed(5)}, {rainfall.longitude.toFixed(5)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {language === 'te' ? 'తనిఖీ చేసిన తేదీ' : 'Queried date'}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {rainfall.queried_date}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {language === 'te' ? 'డేటా మూలం' : 'Data source'}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {rainfall.source}
                </p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {rainfall.note}
            </p>
          </div>
        )}
      </section>

      <form
        onSubmit={confirmDetails}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="mb-7 space-y-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5">
          <VisualTapSelector
            kind="crop"
            value={form.crop}
            language={language}
            onSelect={(value) => setField('crop', value)}
          />
          <VisualTapSelector
            kind="calamity"
            value={form.calamity_type}
            language={language}
            onSelect={(value) => setField('calamity_type', value)}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={labelClass} htmlFor="farmer-alias">
            {language === 'te' ? 'రైతు పేరు లేదా గుర్తింపు' : 'Farmer name or alias'}
            <input
              id="farmer-alias"
              value={form.farmer_alias}
              onChange={(event) => setField('farmer_alias', event.target.value)}
              className={fieldClass}
              autoComplete="name"
            />
          </label>

          <label className={labelClass} htmlFor="crop">
            {copy.fields.crop}
            <input
              id="crop"
              value={form.crop}
              onChange={(event) => setField('crop', event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className={labelClass} htmlFor="calamity-type">
            {copy.fields.calamity}
            <select
              id="calamity-type"
              value={form.calamity_type}
              onChange={(event) => setField('calamity_type', event.target.value)}
              className={fieldClass}
            >
              <option value="">
                {language === 'te' ? 'ఎంచుకోండి' : 'Select an event'}
              </option>
              {calamityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {language === 'te' ? option.te : option.en}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass} htmlFor="incident-date">
            {copy.fields.incidentDate}
            <input
              id="incident-date"
              type="date"
              value={form.incident_date}
              onChange={(event) => setField('incident_date', event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className={labelClass} htmlFor="village">
            {copy.fields.village}
            <input
              id="village"
              value={form.village}
              onChange={(event) => setField('village', event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className={labelClass} htmlFor="district">
            {copy.fields.district}
            <input
              id="district"
              value={form.district}
              onChange={(event) => setField('district', event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className={labelClass} htmlFor="affected-area">
            {copy.fields.affectedArea}
            <input
              id="affected-area"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.affected_area_acres}
              onChange={(event) =>
                setField('affected_area_acres', event.target.value)
              }
              className={fieldClass}
            />
          </label>

          <label className={labelClass} htmlFor="crop-stage">
            {language === 'te' ? 'పంట దశ' : 'Crop stage'}
            <input
              id="crop-stage"
              value={form.crop_stage}
              onChange={(event) => setField('crop_stage', event.target.value)}
              className={fieldClass}
              placeholder={
                language === 'te'
                  ? 'ఉదా: పెరుగుతున్న పంట'
                  : 'For example: Standing crop'
              }
            />
          </label>

          <label className={`${labelClass} sm:col-span-2`} htmlFor="insurance-status">
            {copy.fields.insuranceStatus}
            <select
              id="insurance-status"
              value={form.insurance_status}
              onChange={(event) =>
                setField('insurance_status', event.target.value)
              }
              className={fieldClass}
            >
              <option value="">
                {language === 'te' ? 'ఎంచుకోండి' : 'Select your status'}
              </option>
              {insuranceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {language === 'te' ? option.te : option.en}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {language === 'te'
              ? 'నిర్ధారణ తర్వాత పాలసీ మార్గదర్శకాలు కనిపిస్తాయి.'
              : 'Policy guidance appears after you confirm these details.'}
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            <CheckCircle2 size={19} aria-hidden="true" />
            {isSaving
              ? language === 'te'
                ? 'సేవ్ చేస్తోంది...'
                : 'Saving...'
              : language === 'te'
                ? 'నా వివరాలను నిర్ధారించండి'
                : 'Confirm My Details'}
          </button>
        </div>
      </form>
    </section>
  )
}
