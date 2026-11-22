import { useState } from 'react'
import {
  Banknote,
  Building2,
  CalendarClock,
  Check,
  ClipboardCopy,
  ClipboardList,
  ExternalLink,
  Info,
  Landmark,
  MapPinned,
  Newspaper,
  PhoneCall,
  ShieldAlert,
  Smartphone,
  type LucideIcon,
  UserRound,
} from 'lucide-react'

import { useSpeech } from '../hooks/useSpeech'
import { type Language } from '../i18n/labels'
import type { GuidanceResponse, IncidentCase } from '../types'

interface PolicyGuidanceProps {
  caseData: IncidentCase
  guidance: GuidanceResponse | null
  language: Language
  isLoading?: boolean
}

interface OfficialPortal {
  icon: LucideIcon
  titleEn: string
  titleTe: string
  badgeEn: string
  badgeTe: string
  whenEn: string
  whenTe: string
  url: string
  phoneUrl?: string
}

const officialPortals: OfficialPortal[] = [
  {
    icon: Landmark,
    titleEn: 'PMFBY National Portal',
    titleTe: 'PMFBY జాతీయ పోర్టల్',
    badgeEn: 'OFFICIAL GOVT PORTAL',
    badgeTe: 'అధికారిక ప్రభుత్వ పోర్టల్',
    whenEn: 'Check policy details, calculate your premium and track claim status.',
    whenTe: 'పాలసీ వివరాలు చూడటానికి, ప్రీమియం లెక్కించడానికి, క్లెయిమ్ స్థితిని తెలుసుకోవడానికి.',
    url: 'https://pmfby.gov.in/',
  },
  {
    icon: PhoneCall,
    titleEn: 'Krishi Rakshak Helpline 14447',
    titleTe: 'కృషి రక్షక్ హెల్ప్‌లైన్ 14447',
    badgeEn: 'TOLL-FREE HELPLINE',
    badgeTe: 'టోల్-ఫ్రీ హెల్ప్‌లైన్',
    whenEn: 'Call promptly to report crop loss; eligible localized losses have a 72-hour intimation window.',
    whenTe: 'పంట నష్టాన్ని వీలైనంత త్వరగా తెలియజేయండి; అర్హమైన స్థానిక నష్టాలకు 72 గంటల సమాచారం గడువు వర్తిస్తుంది.',
    url: 'https://pmfby.gov.in/',
    phoneUrl: 'tel:14447',
  },
  {
    icon: Smartphone,
    titleEn: 'Crop Insurance Mobile App',
    titleTe: 'క్రాప్ ఇన్సూరెన్స్ మొబైల్ యాప్',
    badgeEn: 'OFFICIAL GOVT PORTAL',
    badgeTe: 'అధికారిక ప్రభుత్వ పోర్టల్',
    whenEn: 'Use the app to submit geo-tagged field-loss photos and report an incident.',
    whenTe: 'స్థాన గుర్తింపు ఉన్న పొలం నష్టం ఫోటోలను సమర్పించడానికి, సంఘటనను నివేదించడానికి యాప్‌ను ఉపయోగించండి.',
    url: 'https://pmfby.gov.in/',
  },
  {
    icon: Building2,
    titleEn: 'Telangana Agriculture Department',
    titleTe: 'తెలంగాణ వ్యవసాయ శాఖ',
    badgeEn: 'OFFICIAL GOVT PORTAL',
    badgeTe: 'అధికారిక ప్రభుత్వ పోర్టల్',
    whenEn: 'Find state crop advisories, AEO / Rythu Vedika support and district offices.',
    whenTe: 'రాష్ట్ర పంట సూచనలు, AEO / రైతు వేదిక సహాయం, జిల్లా కార్యాలయాల వివరాల కోసం.',
    url: 'https://agri.telangana.gov.in/',
  },
  {
    icon: MapPinned,
    titleEn: 'Nearest CSC Center Locator',
    titleTe: 'సమీప CSC కేంద్రం',
    badgeEn: 'OFFICIAL GOVT PORTAL',
    badgeTe: 'అధికారిక ప్రభుత్వ పోర్టల్',
    whenEn: 'Find assisted online services for claim preparation, especially if you are a non-loanee farmer.',
    whenTe: 'రుణం లేని రైతులకు సహా, ఆన్‌లైన్ క్లెయిమ్ సిద్ధతకు సహాయం చేసే కేంద్రాన్ని కనుగొనండి.',
    url: 'https://locator.csccloud.in/',
  },
  {
    icon: Newspaper,
    titleEn: 'PIB Official Claim Records',
    titleTe: 'PIB అధికారిక క్లెయిమ్ రికార్డులు',
    badgeEn: 'OFFICIAL GOVT PORTAL',
    badgeTe: 'అధికారిక ప్రభుత్వ పోర్టల్',
    whenEn: 'Browse government-published farmer settlement announcements and verify the cited release.',
    whenTe: 'ప్రభుత్వం ప్రచురించిన రైతు పరిష్కార ప్రకటనలను చూడండి; సూచించిన విడుదలను ధృవీకరించండి.',
    url: 'https://pib.gov.in/',
  },
]

const claimTimeline: {
  icon: LucideIcon
  titleEn: string
  titleTe: string
  noteEn: string
  noteTe: string
}[] = [
  {
    icon: PhoneCall,
    titleEn: 'Intimate Loss',
    titleTe: 'నష్టం తెలియజేయండి',
    noteEn: 'Within 72 Hours',
    noteTe: '72 గంటల్లో',
  },
  {
    icon: UserRound,
    titleEn: 'Surveyor Field Visit',
    titleTe: 'సర్వేయర్ పొలం సందర్శన',
    noteEn: 'Within 10 Days',
    noteTe: '10 రోజుల్లో',
  },
  {
    icon: ClipboardList,
    titleEn: 'Joint Loss Assessment Report',
    titleTe: 'సంయుక్త నష్టం అంచనా నివేదిక',
    noteEn: 'After field assessment',
    noteTe: 'క్షేత్ర పరిశీలన తర్వాత',
  },
  {
    icon: Banknote,
    titleEn: 'Direct Bank Claim Settlement',
    titleTe: 'బ్యాంకు ద్వారా క్లెయిమ్ పరిష్కారం',
    noteEn: 'If approved under applicable rules',
    noteTe: 'వర్తించే నిబంధనల ప్రకారం ఆమోదమైతే',
  },
]

function getCallScript(caseData: IncidentCase, language: Language): string {
  const missing = language === 'te' ? 'తెలియదు' : 'not provided'
  const farmer = caseData.farmer_alias?.trim() || missing
  const village = caseData.village?.trim() || missing
  const district = caseData.district?.trim() || missing
  const crop = caseData.crop?.trim() || missing
  const incidentDate = caseData.incident_date || missing
  const area =
    caseData.affected_area_acres == null
      ? missing
      : `${caseData.affected_area_acres} ${language === 'te' ? 'ఎకరాలు' : 'acres'}`
  const calamityNames: Record<string, { en: string; te: string }> = {
    flood_inundation: { en: 'flood or inundation', te: 'వరద లేదా నీట మునక' },
    hailstorm: { en: 'hailstorm', te: 'వడగళ్ల వర్షం' },
    heavy_rain: { en: 'heavy rain', te: 'భారీ వర్షం' },
    unseasonal_rain: { en: 'unseasonal rain', te: 'అకాల వర్షం' },
    post_harvest_rain: { en: 'post-harvest rain', te: 'కోత తర్వాత వర్షం' },
    other: { en: 'the reported event', te: 'నమోదైన సంఘటన' },
  }
  const calamity =
    calamityNames[caseData.calamity_type ?? '']?.[language] ?? missing

  if (language === 'te') {
    return `నమస్కారం, నా పేరు ${farmer}. PMFBY కింద పంట నష్టాన్ని తెలియజేయడానికి 14447కు కాల్ చేస్తున్నాను. నా కేసు సూచన సంఖ్య ${caseData.id}. సంఘటన ${incidentDate} తేదీన ${village}, ${district}లో జరిగింది. నా ${crop} పంటకు ${calamity} వల్ల నష్టం జరిగింది. సుమారు ${area} ప్రభావితమయ్యాయి. దయచేసి నా నష్టం సమాచారాన్ని నమోదు చేసి, అంగీకార సంఖ్య మరియు తదుపరి చర్యలను తెలియజేయండి.`
  }

  return `Hello, my name is ${farmer}. I am calling 14447 to report crop loss under PMFBY. My case reference is ${caseData.id}. The incident happened on ${incidentDate} in ${village}, ${district}. My ${crop} crop was affected by ${calamity}. About ${area} were affected. Please register my loss intimation and tell me the acknowledgement number and next steps.`
}

export function PolicyGuidance({
  caseData,
  guidance,
  language,
  isLoading = false,
}: PolicyGuidanceProps) {
  const { speak } = useSpeech()
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | null>(null)
  const deadline = guidance?.deadline_evaluation
  const hasKnownIncident = Boolean(caseData.calamity_type && caseData.incident_date)
  const has72HourWindow = deadline?.window_hours === 72
  const callScript = getCallScript(caseData, language)
  const loaneeRoute = caseData.insurance_status === 'enrolled_loanee'
  const routeText =
    language === 'te'
      ? loaneeRoute
        ? '72 గంటల్లో ముందుగా 14447కు కాల్ చేయండి మరియు మీ బ్యాంకు శాఖకు ఒక ప్రతిని సమర్పించండి.'
        : '72 గంటల్లో ముందుగా 14447కు కాల్ చేయండి లేదా క్రాప్ ఇన్సూరెన్స్ మొబైల్ యాప్ / CSC ద్వారా నివేదించండి.'
      : loaneeRoute
        ? 'Call 14447 first within 72 hours AND submit a copy to your Bank Branch.'
        : 'Call 14447 first within 72 hours or report via Crop Insurance Mobile App / CSC.'

  const copyCallScript = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard access is unavailable in this browser.')
      }
      await navigator.clipboard.writeText(callScript)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="policy-guidance-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {language === 'te' ? 'దశ 3 · పాలసీ మార్గదర్శకం' : 'Step 3 · Policy guidance'}
        </p>
        <h2
          id="policy-guidance-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {language === 'te'
            ? 'వర్తించే PMFBY మార్గదర్శకాలు'
            : 'Applicable PMFBY guidance'}
        </h2>
        <p className="mt-2 text-slate-600">
          {language === 'te'
            ? 'ఇవి సిద్ధత సమాచారం మాత్రమే. తుది నిర్ణయం బీమా సంస్థ లేదా సంబంధిత అధికారులదే.'
            : 'This is preparation information only. The insurer or competent authority makes final decisions.'}
        </p>
      </div>

      <section
        aria-labelledby="best-reporting-route-title"
        className="overflow-hidden rounded-3xl border-2 border-emerald-950 bg-[#14532d] text-white shadow-xl"
      >
        <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
              {language === 'te' ? 'మీ తక్షణ నివేదన మార్గం' : 'YOUR BEST REPORTING ROUTE'}
            </p>
            <h3
              id="best-reporting-route-title"
              className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl"
            >
              {language === 'te'
                ? 'పంట నష్టాన్ని త్వరగా నివేదించండి'
                : 'Report your crop loss promptly'}
            </h3>
            <p className="mt-3 max-w-3xl text-base font-semibold leading-relaxed text-emerald-50 sm:text-lg">
              {routeText}
            </p>
          </div>
          <a
            href="tel:14447"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-3 text-lg font-black text-emerald-950 shadow-md transition hover:bg-amber-300 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <PhoneCall size={21} aria-hidden="true" />
            {language === 'te' ? '14447కు కాల్ చేయండి' : 'Call 14447'}
          </a>
        </div>
      </section>

      <section
        aria-labelledby="claim-timeline-title"
        className="rounded-3xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h3 id="claim-timeline-title" className="text-lg font-extrabold text-slate-950">
            {language === 'te' ? 'నివేదించిన తర్వాతి 4 దశలు' : 'What happens after reporting'}
          </h3>
          <p className="text-xs text-slate-500">
            {language === 'te'
              ? 'సమయాలు వర్తించే నియమాలు మరియు పరిశీలనపై ఆధారపడతాయి.'
              : 'Indicative sequence; timing depends on applicable rules and assessment.'}
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {claimTimeline.map((stage, index) => {
            const Icon = stage.icon
            return (
              <li
                key={stage.titleEn}
                className="relative rounded-2xl border border-emerald-100 bg-[#f0f7ea] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-900 text-amber-300">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-black text-emerald-800">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h4 className="mt-3 font-extrabold leading-snug text-emerald-950">
                  {language === 'te' ? stage.titleTe : stage.titleEn}
                </h4>
                <p className="mt-1 text-sm font-bold text-amber-800">
                  {language === 'te' ? stage.noteTe : stage.noteEn}
                </p>
              </li>
            )
          })}
        </ol>
      </section>

      <section
        aria-labelledby="call-script-title"
        className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-900">
              {language === 'te' ? '14447 కాల్‌కు సిద్ధమైన స్క్రిప్ట్' : 'READY-TO-READ CALL SCRIPT'}
            </p>
            <h3 id="call-script-title" className="mt-1 text-xl font-black text-amber-950">
              {language === 'te' ? '14447కు ఏమి చెప్పాలి' : 'What to Say on 14447'}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => speak(callScript, language === 'te' ? 'te-IN' : 'en-IN')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
            >
              <PhoneCall size={16} aria-hidden="true" />
              {language === 'te' ? 'చదివి వినిపించండి' : 'Read Aloud'}
            </button>
            <button
              type="button"
              onClick={() => void copyCallScript()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-800 bg-white px-4 py-2 text-sm font-bold text-amber-950 transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
            >
              {copyStatus === 'copied' ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <ClipboardCopy size={16} aria-hidden="true" />
              )}
              {copyStatus === 'copied'
                ? language === 'te'
                  ? 'కాపీ అయింది'
                  : 'Copied'
                : language === 'te'
                  ? 'స్క్రిప్ట్ కాపీ చేయండి'
                  : 'Copy Script'}
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-base leading-relaxed text-slate-900">
          {callScript}
        </p>
        <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-amber-950">
          {copyStatus === 'error'
            ? language === 'te'
              ? 'కాపీ చేయలేకపోయాం. స్క్రిప్ట్‌ను ఎంచుకుని కాపీ చేయండి.'
              : 'Could not copy. Select and copy the script manually.'
            : ''}
        </p>
      </section>

      {!hasKnownIncident || !has72HourWindow ? (
        <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
          <Info size={21} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
          <div>
            <h3 className="font-bold">
              {language === 'te' ? 'గడువు వివరాలు నిర్ధారించాలి' : 'Deadline information needs confirmation'}
            </h3>
            <p className="mt-1 leading-relaxed">
              {guidance?.conditional_deadline_note ??
                (language === 'te'
                  ? 'సంఘటన రకం లేదా తేదీ తెలియదు కాబట్టి గడువును లెక్కించలేము. మీ బీమా సంస్థను సంప్రదించండి.'
                  : 'The incident type or date is unknown, so a deadline cannot be estimated. Contact your insurer promptly.')}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <CalendarClock
              size={24}
              className="mt-0.5 shrink-0 text-amber-800"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                {language === 'te' ? 'స్థానిక నష్టాల నివేదన గడువు' : 'Localized-loss reporting window'}
              </p>
              <h3 className="mt-1 text-xl font-extrabold text-amber-950">
                {language === 'te'
                  ? 'సంఘటన జరిగిన 72 గంటల్లో సమాచారం ఇవ్వండి'
                  : 'Intimate within 72 hours of the incident'}
              </h3>
              {deadline?.deadline_date && (
                <p className="mt-2 font-semibold text-amber-950">
                  {language === 'te' ? 'తేదీ ఆధారంగా అంచనా గడువు: ' : 'Date-based deadline estimate: '}
                  <time dateTime={deadline.deadline_date}>
                    {deadline.deadline_date}
                  </time>
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-amber-950">
                {language === 'te'
                  ? 'ఇది తేదీ ఆధారిత అంచనా మాత్రమే; ఖచ్చితమైన సంఘటన సమయం నమోదు కాలేదు.'
                  : 'This is a date-based estimate; the exact incident time was not recorded.'}
              </p>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/80 p-3 text-sm leading-relaxed text-amber-950">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {language === 'te'
                    ? 'ఆలస్యమైన సమాచారాన్ని సమర్థ అధికారి పరిశీలిస్తారు; సమీక్ష లేకుండా స్వయంచాలకంగా తిరస్కరించరు.'
                    : 'Delayed intimations are subject to competent authority verification and are not automatically rejected without review.'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <section
        aria-labelledby="official-portals-title"
        className="rounded-3xl border-2 border-emerald-800 bg-[#f0f7ea] p-4 shadow-lg shadow-emerald-950/5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-800">
              {language === 'te' ? 'ప్రభుత్వ ధృవీకరించిన మార్గాలు' : 'Government-verified routes'}
            </p>
            <h3
              id="official-portals-title"
              className="mt-1 text-xl font-black text-emerald-950 sm:text-2xl"
            >
              {language === 'te'
                ? 'అధికారిక ప్రభుత్వ పోర్టల్స్ & 24×7 హెల్ప్‌లైన్లు'
                : 'Official Government Portals & 24×7 Helplines'}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-950/80">
              {language === 'te'
                ? 'నివేదించడానికి, సమాచారం పొందడానికి లేదా అధికారిక రికార్డులను పరిశీలించడానికి సరైన మార్గాన్ని ఎంచుకోండి.'
                : 'Choose the right official route to report a loss, get assistance or check published records.'}
            </p>
          </div>
          <span className="rounded-full bg-emerald-900 px-3 py-1.5 text-xs font-extrabold tracking-wider text-white">
            {language === 'te' ? 'అధికారిక లింకులు మాత్రమే' : 'OFFICIAL LINKS ONLY'}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {officialPortals.map((portal) => {
            const Icon = portal.icon
            return (
              <article
                key={portal.titleEn}
                className="flex h-full flex-col rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-900">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wide ${
                      portal.phoneUrl
                        ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
                        : 'bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200'
                    }`}
                  >
                    {language === 'te' ? portal.badgeTe : portal.badgeEn}
                  </span>
                </div>
                <h4 className="mt-4 text-lg font-extrabold leading-snug text-slate-950">
                  {language === 'te' ? portal.titleTe : portal.titleEn}
                </h4>
                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-emerald-900">
                  {language === 'te' ? 'ఎప్పుడు ఉపయోగించాలి' : 'WHEN TO USE'}
                </p>
                <p className="mt-1 min-h-12 text-sm leading-relaxed text-slate-700">
                  {language === 'te' ? portal.whenTe : portal.whenEn}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {portal.phoneUrl ? (
                    <>
                      <a
                        href={portal.phoneUrl}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-center text-sm font-extrabold text-amber-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                      >
                        <PhoneCall size={17} aria-hidden="true" />
                        {language === 'te' ? 'ఇప్పుడే 14447కు కాల్ చేయండి' : 'Call 14447 Now'}
                      </a>
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={
                          language === 'te'
                            ? 'PMFBY అధికారిక పోర్టల్ తెరవండి'
                            : 'Open PMFBY portal'
                        }
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-800 bg-white px-3 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                      >
                        {language === 'te' ? 'పోర్టల్ ↗' : 'Portal ↗'}
                      </a>
                    </>
                  ) : (
                    <a
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-center text-sm font-extrabold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      {language === 'te' ? 'పోర్టల్ తెరవండి ↗' : 'Open Portal ↗'}
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="policy-passages-title">
        <div className="flex items-end justify-between gap-4">
          <h3 id="policy-passages-title" className="text-lg font-bold text-slate-900">
            {language === 'te' ? 'మూలాలతో పాలసీ సూచనలు' : 'Source-cited policy passages'}
          </h3>
          {isLoading && (
            <span className="text-sm text-slate-500">
              {language === 'te' ? 'లోడ్ అవుతోంది…' : 'Loading…'}
            </span>
          )}
        </div>
        {guidance?.policies.length ? (
          guidance.policies.map((policy) => (
            <article
              key={policy.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900">{policy.title}</h4>
                {policy.page_number && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {language === 'te' ? `పేజీ ${policy.page_number}` : `Page ${policy.page_number}`}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{policy.text}</p>
              <p className="mt-3 text-xs text-slate-500">
                {policy.publisher} · {policy.version_note}
              </p>
              <a
                href={policy.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
              >
                {policy.source_url} <ExternalLink size={14} aria-hidden="true" />
              </a>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
            {language === 'te'
              ? 'పాలసీ సూచనలు లోడ్ అవుతున్నాయి లేదా ప్రస్తుతం అందుబాటులో లేవు.'
              : 'Policy passages are loading or are currently unavailable.'}
          </div>
        )}
      </section>
    </section>
  )
}
