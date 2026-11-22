import { useEffect, useState } from 'react'
import {
  AudioLines,
  BadgeCheck,
  CloudRain,
  Crosshair,
  FileCheck2,
  Mic,
  MapPin,
  Radio,
  Sprout,
  Timer,
} from 'lucide-react'

import { labels, type Language } from '../i18n/labels'
import { apiRequest, jsonRequest } from '../lib/api'
import type { IncidentCase } from '../types'

interface HeroFarmBannerProps {
  language: Language
  onLanguageChange: (language: Language) => void
  onLoadDemo: () => void
  isLoadingDemo: boolean
  onStartIntake: () => void
}

export function HeroFarmBanner({
  language,
  onLanguageChange,
  onLoadDemo,
  isLoadingDemo,
  onStartIntake,
}: HeroFarmBannerProps) {
  const copy = labels[language]
  const [clock, setClock] = useState(() => new Date())
  const [useHeroPhotoFallback, setUseHeroPhotoFallback] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = new Intl.DateTimeFormat(
    language === 'te' ? 'te-IN' : 'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    },
  ).format(clock)
  const date = new Intl.DateTimeFormat(
    language === 'te' ? 'te-IN' : 'en-IN',
    {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  ).format(clock)

  return (
    <header className="overflow-hidden bg-[#14532d] text-white shadow-xl">
      <div className="border-b border-white/15 bg-[#14532d]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7 lg:px-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/15 px-3 py-2 text-[10px] font-black tracking-[0.12em] text-emerald-50 sm:text-xs">
            <Sprout size={16} className="text-[#fbbf24]" aria-hidden="true" />
            TELANGANA FARMER COMMAND CENTER
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-black/15 px-3 py-2">
              <span className="text-amber-300" aria-hidden="true">◷</span>
              <span className="text-right">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                  {copy.liveClock}
                </span>
                <time className="block font-mono text-xs font-bold tabular-nums text-white sm:text-sm">
                  {time} · {date}
                </time>
              </span>
            </div>
            <div
              className="flex items-center rounded-xl border border-white/20 bg-black/15 p-1"
              aria-label="Choose language"
            >
              {(['en', 'te'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={language === option}
                  onClick={() => onLanguageChange(option)}
                  className={`min-h-10 rounded-lg px-3 text-sm font-extrabold transition ${
                    language === option
                      ? 'bg-[#f59e0b] text-[#17220f] shadow-sm'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  {option === 'en' ? 'English' : 'తెలుగు'}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={isLoadingDemo}
              onClick={onLoadDemo}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#f59e0b] px-4 py-2 text-sm font-extrabold text-[#17220f] shadow-sm transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
              <Sprout size={17} aria-hidden="true" />
              {isLoadingDemo ? copy.demoLoading : copy.demoCase}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0d3b1e]">
        <div className="relative isolate min-h-[560px] overflow-hidden bg-[#0d3b1e]">
          <img
            src={useHeroPhotoFallback ? '/hero-real-farm.jpg' : '/hero-farmer.png'}
            alt="Indian paddy field and farmers"
            className="absolute inset-0 h-full w-full object-cover object-right opacity-95"
            onError={() => setUseHeroPhotoFallback(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d3b1e] via-[#0d3b1e]/85 to-[#0d3b1e]/15" />
          <div className="relative mx-auto flex min-h-[560px] max-w-[1440px] items-center px-4 py-12 sm:px-7 lg:px-10 xl:px-12">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f59e0b] text-[#0d3b1e] shadow-lg ring-4 ring-amber-100/10">
                  <Sprout size={26} aria-hidden="true" />
                </span>
                <span className="text-lg font-black tracking-[0.14em] text-white sm:text-xl">
                  CROPPROOF AI
                </span>
              </div>
              <h1 className="mt-7 max-w-2xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-[3.4rem]">
                Protect Your Crop Claim Before the 72-Hour Window Closes
              </h1>
              <p lang="te" className="mt-5 max-w-2xl text-xl font-extrabold leading-relaxed text-amber-200 sm:text-2xl">
                72 గంటల వ్యవధి ముగిసేలోపే మీ పంట నష్టాన్ని నమోదు చేసుకోండి
              </p>
              <button
                type="button"
                onClick={onStartIntake}
                className="mt-7 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#f59e0b] px-6 py-3 text-center text-base font-black text-[#12351f] shadow-lg transition hover:bg-amber-300 hover:shadow-xl focus-visible:outline-4 focus-visible:outline-offset-3 focus-visible:outline-amber-200 sm:text-lg"
              >
                Start Free Claim • ఉచితంగా ప్రారంభించండి →
              </button>
              <p className="mt-6 inline-flex max-w-xl items-start gap-2 rounded-full border border-amber-200/40 bg-black/20 px-4 py-2.5 text-xs font-bold leading-relaxed text-amber-50 sm:text-sm">
                <span className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true">●</span>
                Independent Claim Preparation Tool — Not a Government or Insurer Portal
              </p>
            </div>
          </div>
          <a
            href="https://commons.wikimedia.org/wiki/File:Farmer_manually_harvesting_rice_in_Raichur,_Karnataka.jpg"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 z-10 rounded-lg border border-white/20 bg-[#0d3b1e]/75 px-2.5 py-1.5 text-[10px] font-medium text-white/90 backdrop-blur-sm hover:bg-[#0d3b1e]/90"
          >
            Photo: Nanditha Gogate / WELL Labs · CC BY-SA 4.0
          </a>
        </div>

        <div className="mx-auto grid max-w-[1440px] gap-3 px-4 pb-6 sm:grid-cols-3 sm:px-7 sm:pb-8 lg:px-10">
          <article className="flex min-h-20 items-center gap-3 rounded-2xl border border-amber-200/80 bg-[#FAF8F2] p-4 text-[#0d3b1e] shadow-md">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[#0d3b1e]">
              <span className="relative flex items-center gap-0.5">
                <Mic size={19} aria-hidden="true" />
                <AudioLines size={17} className="text-amber-700" aria-hidden="true" />
              </span>
            </span>
            <div>
              <h2 className="font-extrabold">Telugu Voice Input</h2>
              <p lang="te" className="text-sm font-semibold text-emerald-900">వాయిస్ ద్వారా నమోదు</p>
            </div>
          </article>
          <article className="flex min-h-20 items-center gap-3 rounded-2xl border border-amber-200/80 bg-[#FAF8F2] p-4 text-[#0d3b1e] shadow-md">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#0d3b1e]">
              <CloudRain size={25} aria-hidden="true" />
              <BadgeCheck size={17} className="absolute -right-1 -top-1 rounded-full bg-[#FAF8F2] text-amber-700" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold">Live Rainfall Verification</h2>
              <p lang="te" className="text-sm font-semibold text-emerald-900">లైవ్ వర్షపాతం నిర్ధారణ</p>
            </div>
          </article>
          <article className="flex min-h-20 items-center gap-3 rounded-2xl border border-amber-200/80 bg-[#FAF8F2] p-4 text-[#0d3b1e] shadow-md">
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[#0d3b1e]">
              <FileCheck2 size={26} aria-hidden="true" />
              <BadgeCheck size={16} className="absolute -right-1 -top-1 rounded-full bg-[#FAF8F2] text-amber-700" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold">Stamped PDF Proof</h2>
              <p lang="te" className="text-sm font-semibold text-emerald-900">ముద్రిత PDF పత్రం</p>
            </div>
          </article>
        </div>
      </div>
    </header>
  )
}

interface LiveTelemetryBannerProps {
  caseData: IncidentCase | null
  language: Language
  onUpdated: (caseData: IncidentCase) => void
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

export function LiveTelemetryBanner({
  caseData,
  language,
  onUpdated,
}: LiveTelemetryBannerProps) {
  const copy = labels[language]
  const [now, setNow] = useState(() => Date.now())
  const [isCapturing, setIsCapturing] = useState(false)
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttempted, setHasAttempted] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const requestLiveProof = async (
    position?: GeolocationPosition,
  ): Promise<void> => {
    if (!caseData) return
    setIsCapturing(true)
    setError(null)
    setHasAttempted(true)
    try {
      const body = position
        ? {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy_m: position.coords.accuracy,
          }
        : {}
      onUpdated(
        await apiRequest<IncidentCase>(
          `/api/cases/${caseData.id}/live-proof`,
          jsonRequest('POST', body),
        ),
      )
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to retrieve live weather telemetry.',
      )
    } finally {
      setIsCapturing(false)
    }
  }

  const captureLiveProof = () => {
    setFallbackUsed(false)
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      !caseData
    ) {
      setFallbackUsed(true)
      void requestLiveProof()
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => void requestLiveProof(position),
      () => {
        setFallbackUsed(true)
        void requestLiveProof()
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
    )
  }

  const deadlineAt =
    caseData?.is_confirmed && caseData.incident_date
      ? Date.parse(`${caseData.incident_date}T00:00:00+05:30`) +
        72 * 60 * 60 * 1000
      : null
  const remaining =
    deadlineAt !== null && Number.isFinite(deadlineAt)
      ? Math.max(0, deadlineAt - now)
      : null
  const formatCoordinate = (value: number | null, digits: number) =>
    value === null ? copy.telemetry.unavailable : value.toFixed(digits)
  const formatMeasurement = (value: number | null, unit: string) =>
    value === null
      ? copy.telemetry.unavailable
      : `${value.toFixed(1)} ${unit}`
  const formatAccuracy = (value: number | null) =>
    value === null
      ? copy.telemetry.unavailable
      : `±${value.toFixed(1)} m`

  return (
    <section
      aria-labelledby="live-proof-title"
      className="border-b border-emerald-900/10 bg-[#f0f7ea] px-4 py-5 sm:px-7 lg:px-10"
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg shadow-emerald-950/5">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#14532d] px-5 py-4 text-white sm:px-7">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f59e0b] text-[#14200f]">
                <Crosshair size={23} aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="live-proof-title" className="text-lg font-extrabold sm:text-xl">
                    {copy.telemetry.title}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/30 bg-black/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-emerald-50">
                    <span
                      className={`size-2 rounded-full ${
                        caseData?.weather_summary?.includes('offline')
                          ? 'bg-amber-400'
                          : 'bg-lime-300'
                      }`}
                    />
                    {caseData?.weather_summary?.includes('offline')
                      ? 'OFFLINE'
                      : 'LIVE PROOF'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-emerald-100">
                  {copy.telemetry.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!caseData || isCapturing}
              onClick={captureLiveProof}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f59e0b] px-5 py-3 font-extrabold text-[#16220f] shadow-sm transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60"
            >
              {isCapturing ? (
                <span className="size-5 animate-spin rounded-full border-2 border-emerald-950/30 border-t-emerald-950" />
              ) : (
                <Radio size={19} aria-hidden="true" />
              )}
              {isCapturing ? copy.telemetry.capturing : copy.telemetry.capture}
            </button>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            <TelemetryValue
              label={copy.telemetry.gpsCoordinates}
              value={
                caseData?.gps_lat === null || caseData?.gps_lon === null
                  ? copy.telemetry.unavailable
                  : `${formatCoordinate(caseData?.gps_lat ?? null, 5)}, ${formatCoordinate(caseData?.gps_lon ?? null, 5)}`
              }
              icon={<MapPin size={18} aria-hidden="true" />}
              accent="emerald"
            />
            <TelemetryValue
              label={copy.telemetry.accuracy}
              value={formatAccuracy(caseData?.gps_accuracy_m ?? null)}
              icon={<Crosshair size={18} aria-hidden="true" />}
              accent="blue"
            />
            <TelemetryValue
              label={copy.telemetry.rainfall72h}
              value={formatMeasurement(caseData?.rainfall_mm_72h ?? null, 'mm')}
              icon={<CloudRain size={19} aria-hidden="true" />}
              accent="amber"
            />
            <TelemetryValue
              label={copy.telemetry.observedAt}
              value={
                caseData?.weather_observed_at
                  ? new Date(caseData.weather_observed_at).toLocaleString(
                      language === 'te' ? 'te-IN' : 'en-IN',
                      { timeZone: 'Asia/Kolkata' },
                    )
                  : copy.telemetry.unavailable
              }
              icon={<Timer size={18} aria-hidden="true" />}
              accent="violet"
              small
            />
          </div>

          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
            <div className="flex items-start gap-3">
              <CloudRain size={18} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  {copy.telemetry.currentWeather}
                </p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-800">
                  {caseData?.weather_summary ?? copy.telemetry.unavailable}
                </p>
              </div>
            </div>
            {remaining !== null && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                  {copy.telemetry.countdown}
                </p>
                <p
                  className="mt-1 font-mono text-2xl font-black tabular-nums tracking-wider text-amber-950"
                  aria-live="off"
                >
                  {formatCountdown(remaining)}
                </p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-amber-900">
                  {remaining === 0
                    ? copy.telemetry.countdownElapsed
                    : copy.telemetry.countdownEstimate}
                </p>
              </div>
            )}
          </div>

          {(fallbackUsed || error || !hasAttempted) && (
            <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 px-5 py-3 text-xs leading-relaxed text-slate-600 sm:px-6">
              {error ? (
                <span role="alert" className="font-semibold text-rose-800">
                  {error}
                </span>
              ) : fallbackUsed ? (
                <span role="status">{copy.telemetry.districtFallback}</span>
              ) : (
                <span>{copy.telemetry.locationConsent}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function TelemetryValue({
  label,
  value,
  icon,
  accent,
  small = false,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent: 'emerald' | 'blue' | 'amber' | 'violet'
  small?: boolean
}) {
  const accentClasses = {
    emerald: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-sky-50 text-sky-800',
    amber: 'bg-amber-50 text-amber-800',
    violet: 'bg-violet-50 text-violet-800',
  }
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={`mt-1 break-words font-extrabold text-slate-950 ${
              small ? 'text-xs leading-relaxed' : 'text-lg tabular-nums'
            }`}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

type VisualSelectionKind = 'crop' | 'calamity'

interface VisualTapSelectorProps {
  kind: VisualSelectionKind
  value: string | null
  language: Language
  onSelect: (value: string) => void
}

const cropChoices = [
  { value: 'Paddy', labelKey: 'paddy', art: 'paddy' },
  { value: 'Cotton', labelKey: 'cotton', art: 'cotton' },
  { value: 'Maize', labelKey: 'maize', art: 'maize' },
  { value: 'Chili', labelKey: 'chili', art: 'chili' },
] as const

const calamityChoices = [
  { value: 'flood_inundation', labelKey: 'flood', art: 'flood' },
  { value: 'hailstorm', labelKey: 'hailstorm', art: 'hail' },
  { value: 'unseasonal_rain', labelKey: 'unseasonalRain', art: 'rain' },
  { value: 'post_harvest_rain', labelKey: 'postHarvestRain', art: 'harvest' },
] as const

export function VisualTapSelector({
  kind,
  value,
  language,
  onSelect,
}: VisualTapSelectorProps) {
  const copy = labels[language]
  const choices = kind === 'crop' ? cropChoices : calamityChoices

  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm font-extrabold text-slate-800">
        {kind === 'crop' ? copy.visual.chooseCrop : copy.visual.chooseCalamity}
      </legend>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {choices.map((choice) => {
          const selected =
            value === choice.value ||
            (choice.value === 'unseasonal_rain' && value === 'heavy_rain')
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(choice.value)}
              className={`group flex min-h-[88px] items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                selected
                  ? 'border-[#f59e0b] bg-amber-50 shadow-md ring-2 ring-amber-200'
                  : 'border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50'
              }`}
            >
              <TapCardArtwork kind={choice.art} />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold leading-snug text-slate-950">
                  {copy.visual[choice.labelKey]}
                </span>
                <span
                  className={`mt-1 block text-[10px] font-bold uppercase tracking-wider ${
                    selected ? 'text-amber-800' : 'text-slate-500'
                  }`}
                >
                  {selected ? copy.visual.selected : copy.visual.tapToSelect}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

type TapArtKind = (typeof cropChoices)[number]['art'] | (typeof calamityChoices)[number]['art']

function TapCardArtwork({ kind }: { kind: TapArtKind }) {
  return (
    <svg
      viewBox="0 0 88 72"
      className="h-14 w-[4.25rem] shrink-0 sm:h-16"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="86" height="70" rx="18" fill="#eaf4e5" />
      {kind === 'paddy' && (
        <g fill="none" strokeLinecap="round">
          <path d="M25 57V24m0 18L15 31m10 22 13-16M44 58V17m0 18L33 24m11 20 13-13M64 57V25m0 15L54 30m10 20 12-15" stroke="#27743d" strokeWidth="4" />
          <g fill="#e2aa26" stroke="#a16b11" strokeWidth="1.5">
            <ellipse cx="39" cy="15" rx="3" ry="5" transform="rotate(-35 39 15)" />
            <ellipse cx="45" cy="12" rx="3" ry="5" />
            <ellipse cx="51" cy="16" rx="3" ry="5" transform="rotate(35 51 16)" />
            <ellipse cx="21" cy="24" rx="2.5" ry="4" transform="rotate(-30 21 24)" />
            <ellipse cx="27" cy="21" rx="2.5" ry="4" />
          </g>
          <path d="M9 58h70" stroke="#8bb27a" strokeWidth="3" />
        </g>
      )}
      {kind === 'cotton' && (
        <g strokeLinecap="round">
          <path d="M44 61V26m0 19L25 32m19 22 19-20" fill="none" stroke="#397b42" strokeWidth="4" />
          <path d="m24 32 12 3-5 10-10-4Zm40-1-11 4 5 10 10-5Z" fill="#5b9b4c" stroke="#36743d" strokeWidth="2" />
          <g fill="#fffdf2" stroke="#c8d0bc" strokeWidth="2">
            <circle cx="41" cy="20" r="9" />
            <circle cx="33" cy="23" r="7" />
            <circle cx="48" cy="24" r="7" />
          </g>
          <path d="m35 29 9 2 7-5-4 12-8-1Z" fill="#8f6938" />
        </g>
      )}
      {kind === 'maize' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M44 62V16m0 33L22 32m22 14 22-21" fill="none" stroke="#398047" strokeWidth="5" />
          <path d="M43 18c-10 2-12 22 1 36 11-6 14-30 2-36Z" fill="#f7c844" stroke="#ba8a1b" strokeWidth="2" />
          <path d="M43 23v25m-6-21 13 3m-14 4 14 3m-12 3 10 3" fill="none" stroke="#e9a926" strokeWidth="2" />
          <path d="M45 18c-7-8-9-3-7 3m9-3c7-8 9-2 6 4" fill="none" stroke="#855d27" strokeWidth="2" />
        </g>
      )}
      {kind === 'chili' && (
        <g fill="none" strokeLinecap="round">
          <path d="M23 60c4-18 18-31 34-37m-16 42c8-17 20-24 34-29" stroke="#317842" strokeWidth="4" />
          <path d="M56 23c-7 11-17 21-14 29 2 5 10 2 15-5 4-6 2-16 4-21" fill="#dc3f28" stroke="#a82619" strokeWidth="2.5" />
          <path d="M72 33c-7 8-17 15-15 22 2 5 8 3 13-2 5-6 3-14 5-19" fill="#f04a2a" stroke="#ae2e1d" strokeWidth="2.5" />
          <path d="m55 23 2-7m16 17 2-7" stroke="#317842" strokeWidth="3" />
        </g>
      )}
      {kind === 'flood' && (
        <g fill="none" strokeLinecap="round">
          <path d="M15 35c1-8 8-13 16-12 4-13 23-13 28-1 10-2 17 6 14 15H25c-7 0-11-1-10-2Z" fill="#7d9eaa" stroke="#4f7180" strokeWidth="2.5" />
          <path d="m28 42-4 7m18-7-4 7m18-7-4 7" stroke="#3286a0" strokeWidth="3" />
          <path d="M11 55c7-6 13 6 20 0s13 6 20 0 13 6 20 0 9 1 11 3M10 63c7-6 13 6 20 0s13 6 20 0 13 6 20 0 9 1 11 3" stroke="#237ca0" strokeWidth="3" />
        </g>
      )}
      {kind === 'hail' && (
        <g>
          <path d="M17 37c0-8 7-13 15-12 4-13 23-13 28-1 10-2 17 6 14 15H28c-7 0-11-1-11-2Z" fill="#7d8c99" stroke="#536271" strokeWidth="2.5" />
          <g fill="#f8fcff" stroke="#76a7c7" strokeWidth="2">
            <circle cx="28" cy="49" r="4" />
            <circle cx="45" cy="52" r="5" />
            <circle cx="63" cy="48" r="4" />
          </g>
          <path d="M20 63h48" stroke="#6b984e" strokeLinecap="round" strokeWidth="3" />
        </g>
      )}
      {kind === 'rain' && (
        <g fill="none" strokeLinecap="round">
          <path d="M15 35c0-8 7-13 15-12 4-13 23-13 28-1 10-2 17 6 14 15H26c-7 0-11-1-11-2Z" fill="#647b88" stroke="#425c68" strokeWidth="2.5" />
          <path d="m28 43-5 11m20-11-5 11m20-11-5 11" stroke="#2785a4" strokeWidth="3.5" />
          <path d="M12 61c9-4 13 4 22 0s13 4 22 0 12 4 20 0" stroke="#4d8c58" strokeWidth="3" />
        </g>
      )}
      {kind === 'harvest' && (
        <g fill="none" strokeLinecap="round">
          <path d="M20 58V29m0 19L12 40m8 13 10-12M39 58V21m0 18L31 29m8 17 10-12M59 58V31m0 15-8-8m8 14 10-12" stroke="#588341" strokeWidth="3.5" />
          <path d="M10 60h68" stroke="#bd9b49" strokeWidth="4" />
          <path d="M64 25c-2-7 4-12 9-9-1 5-3 8-9 9Zm-6 4c-4-7 0-12 6-11 1 5-1 9-6 11Z" fill="#b98a30" stroke="#906b24" strokeWidth="1.5" />
          <path d="m72 20 2-5m-14 12-3-5" stroke="#548144" strokeWidth="2" />
        </g>
      )}
    </svg>
  )
}

export type PhotoGuideKind =
  | 'wide_field'
  | 'closeup_crop'
  | 'landmark'
  | 'insurance_doc'

export function PhotoGuideIllustration({
  kind,
  language,
}: {
  kind: PhotoGuideKind
  language: Language
}) {
  const title =
    language === 'te'
      ? kind === 'wide_field'
        ? 'పొలం మొత్తం'
        : kind === 'closeup_crop'
          ? 'పంట దగ్గరి చిత్రం'
          : kind === 'landmark'
            ? 'పొలం గుర్తు'
            : 'పత్రం ఫ్రేమ్'
      : kind === 'wide_field'
        ? 'Wide field framing'
        : kind === 'closeup_crop'
          ? 'Crop detail framing'
          : kind === 'landmark'
            ? 'Landmark framing'
            : 'Document framing'
  return (
    <svg
      viewBox="0 0 320 144"
      className="h-28 w-full rounded-xl bg-[#e8f1dd]"
      role="img"
      aria-label={title}
    >
      <rect x="9" y="9" width="302" height="126" rx="14" fill="#edf5e6" />
      {kind === 'wide_field' && (
        <g>
          <path d="M20 81 158 40l142 41v43H20Z" fill="#7ca453" />
          <path d="M20 98 157 70l143 28v29H20Z" fill="#4a824d" />
          <g fill="none" stroke="#d9c778" strokeWidth="3">
            <path d="M42 110 157 74l111 35M77 126l80-42 71 42M115 131l42-46 36 46" />
          </g>
          <path d="M34 73V44h24v22m216 8V42h17v29" fill="#c69a55" stroke="#6f633a" strokeWidth="3" />
          <path d="M13 21h28M13 21v19m294-19h-28m28 0v19M13 122h28m-28 0v-19m294 19h-28m28 0v-19" fill="none" stroke="#14532d" strokeWidth="4" />
        </g>
      )}
      {kind === 'closeup_crop' && (
        <g>
          <path d="M157 128V36m0 53c-23-23-50-21-66-11 19 29 42 39 66 29m0-16c21-26 46-29 69-17-14 28-40 43-69 35" fill="#75a94e" stroke="#3b753d" strokeWidth="5" strokeLinejoin="round" />
          <path d="M157 105c-3-26 7-45 19-57" fill="none" stroke="#bb9d3e" strokeWidth="5" strokeLinecap="round" />
          <path d="m45 38 14-14m0 0v12m0-12H47m229 83 14 14m0 0h-13m13 0v-13" fill="none" stroke="#14532d" strokeWidth="4" />
          <circle cx="223" cy="51" r="8" fill="#e6ab55" />
          <circle cx="104" cy="73" r="7" fill="#ad7650" />
        </g>
      )}
      {kind === 'landmark' && (
        <g>
          <path d="M24 89h272v42H24Z" fill="#78a54e" />
          <path d="M24 109c82-19 185-8 272 7" fill="none" stroke="#c4aa69" strokeWidth="9" />
          <path d="M45 80 81 54l36 26v43H45Z" fill="#d5aa67" stroke="#765c39" strokeWidth="3" />
          <path d="m37 58 44-31 44 31" fill="#9c6645" stroke="#654532" strokeWidth="4" />
          <path d="M71 123V91h20v32" fill="#78513a" />
          <path d="M217 104V46m0 0 22 11-22 8" fill="none" stroke="#14532d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M190 125h96" stroke="#617c45" strokeWidth="4" />
        </g>
      )}
      {kind === 'insurance_doc' && (
        <g>
          <rect x="99" y="19" width="122" height="111" rx="7" fill="#fffdf5" stroke="#48724a" strokeWidth="3" />
          <path d="M116 40h87m-87 16h70m-70 17h87m-87 17h54" stroke="#8b9b8a" strokeWidth="4" strokeLinecap="round" />
          <rect x="166" y="94" width="37" height="22" rx="4" fill="#e8f4e3" stroke="#43814c" strokeWidth="2" />
          <path d="m174 105 6 6 14-16" fill="none" stroke="#27733d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 114h46m180 0h42" stroke="#afc7a6" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
