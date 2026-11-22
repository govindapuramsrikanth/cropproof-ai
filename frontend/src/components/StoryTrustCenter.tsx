import {
  ExternalLink,
  FileText,
  HelpCircle,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'

import type { Language } from '../i18n/labels'
import type { FarmerStory, IncidentCase } from '../types'

interface StoryTrustCenterProps {
  caseData: IncidentCase
  language: Language
  matchedStories: FarmerStory[]
  publicStories: FarmerStory[]
  transcript: string
}

function storyMatchReason(
  story: FarmerStory,
  caseData: IncidentCase,
  transcript: string,
  language: Language,
): string {
  if (story.match_reason) {
    if (language === 'te') {
      return story.match_reason.startsWith('Best Match')
        ? 'మీ కేసులోని పంట లేదా విపత్తు వివరాలు ఈ PIB కథతో సరిపోతున్నాయి.'
        : 'ధృవీకరించిన PMFBY ప్రజా ఖాతా — సూచన ఉదాహరణ.'
    }
    return story.match_reason
  }

  const calamities = story.calamity_tags.map((tag) => tag.toLowerCase())
  const crops = story.crop_tags.map((tag) => tag.toLowerCase())
  const currentCalamity = caseData.calamity_type?.toLowerCase()
  const currentCrop = caseData.crop?.toLowerCase()
  if (currentCalamity && calamities.includes(currentCalamity)) {
    return language === 'te'
      ? 'ఈ కథలోని విపత్తు రకం మీ కేసులో నమోదు చేసిన విపత్తుతో సరిపోతుంది.'
      : `Its calamity tag matches the reported ${currentCalamity.replaceAll('_', ' ')} event.`
  }
  if (currentCrop && crops.includes(currentCrop)) {
    return language === 'te'
      ? 'ఈ కథలోని పంట మీ కేసులో నమోదు చేసిన పంటతో సరిపోతుంది.'
      : `Its crop tags include ${caseData.crop}.`
  }
  const hasHeavyRain =
    /heavy rain|heavy rainfall|భారీ వర్ష/i.test(transcript) &&
    calamities.includes('heavy_rain')
  if (hasHeavyRain) {
    return language === 'te'
      ? 'మీరు వివరించిన భారీ వర్షం ఈ PIB కథలోని వాతావరణ సంఘటనతో సరిపోతుంది.'
      : 'The transcript mentions heavy rain, matching the weather event tagged in this PIB story.'
  }
  return language === 'te'
    ? 'ఈ కథను మీ నమోదైన సంఘటనకు సంబంధించిన ప్రజా ఆధారంగా చూపిస్తున్నాం.'
    : 'This public account is shown as a reference related to the reported incident.'
}

function relevantStories(
  matchedStories: FarmerStory[],
  publicStories: FarmerStory[],
): FarmerStory[] {
  const results = new Map<string, FarmerStory>()
  publicStories.forEach((story) => results.set(story.id, story))
  matchedStories.forEach((story) => results.set(story.id, story))
  return [...results.values()]
}

export function StoryTrustCenter({
  caseData,
  language,
  matchedStories,
  publicStories,
  transcript,
}: StoryTrustCenterProps) {
  const stories = relevantStories(matchedStories, publicStories)

  return (
    <section className="mt-8 space-y-5" aria-labelledby="story-trust-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {language === 'te' ? 'ధృవీకరించిన రైతు పరిష్కారాలు' : 'Verified farmer settlement proof'}
        </p>
        <h2
          id="story-trust-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900"
        >
          {language === 'te'
            ? 'ప్రభుత్వం ప్రచురించిన PMFBY రైతు ఖాతాలు'
            : 'Government-published PMFBY farmer accounts'}
        </h2>
        <p className="mt-2 text-slate-600">
          {language === 'te'
            ? 'ఈ కథలు అధికారికంగా ప్రచురించిన ఖాతాలు మాత్రమే; మీ కేసు ఫలితాన్ని ఇవి నిర్ణయించవు.'
            : 'These are published accounts for context only; they do not determine the outcome of your case.'}
        </p>
      </div>

      {stories.length === 0 ? (
        <div
          role="status"
          className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 font-semibold text-emerald-950"
        >
          {language === 'te'
            ? 'అధికారిక PIB రైతు ఖాతాలు లోడ్ అవుతున్నాయి. దయచేసి కొద్దిసేపట్లో మళ్లీ ప్రయత్నించండి.'
            : 'Official PIB farmer accounts are loading. Please check again shortly.'}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {stories.map((story) => {
            const premium =
              story.premium_paid_display ||
              story.known_facts.reported_premium ||
              (language === 'te'
                ? 'ఈ PIB ఖాతాలో మొత్తం పేర్కొనలేదు'
                : 'Amount not stated in this PIB account')
            const payout =
              story.payout_received_display ||
              story.known_facts.reported_outcome ||
              (language === 'te'
                ? 'ఈ PIB ఖాతాలో పరిహారం మొత్తం పేర్కొనలేదు'
                : 'Compensation amount not stated in this PIB account')
            const videoUrl =
              story.video_reference_url || 'https://www.youtube.com/@DDKisan'
            const videoTitle =
              language === 'te'
                ? 'అధికారిక DD Kisan / వ్యవసాయ మంత్రిత్వ శాఖ క్లెయిమ్ ప్రక్రియ & రైతు కథలు'
                : 'Watch Official DD Kisan / Ministry of Agriculture Claim Process & Farmer Stories'
            return (
              <article
                key={story.id}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {story.farmer_name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {story.location_state} · {story.scheme_tag}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                  <ShieldCheck size={15} aria-hidden="true" />
                  Government-published account (PIB)
                </span>
              </div>

              <div className="mt-4 grid overflow-hidden rounded-2xl border border-emerald-900/15 sm:grid-cols-2">
                <div className="bg-[#14532d] p-4 text-white sm:p-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
                    {language === 'te' ? 'రైతు చెల్లించిన ప్రీమియం' : 'Farmer Premium Paid'}
                  </p>
                  <p className="mt-2 text-xl font-black leading-snug text-white sm:text-2xl">
                    {premium}
                  </p>
                </div>
                <div className="bg-[#f59e0b] p-4 text-amber-950 sm:p-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-amber-950">
                    {language === 'te'
                      ? 'ధృవీకరించిన పరిహారం చెల్లింపు'
                      : 'Verified Compensation Settled'}
                  </p>
                  <p className="mt-2 text-xl font-black leading-snug sm:text-2xl">
                    {payout}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {language === 'te'
                  ? 'మొత్తాలు PIB ప్రచురించిన ఖాతాలో ఉన్నట్లుగా మాత్రమే చూపబడ్డాయి; పేర్కొనని వివరాలను అంచనా వేయలేదు.'
                  : 'Figures are shown only as reported in the PIB account; unstated amounts are not inferred.'}
              </p>

              <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  {language === 'te' ? 'ఈ కథ ఎందుకు సరిపోయింది' : 'Why This Story Matched'}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-sky-950">
                  {storyMatchReason(story, caseData, transcript, language)}
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                      <FileText size={16} className="text-emerald-800" aria-hidden="true" />
                      {language === 'te'
                        ? 'అధికారిక PIB పత్రికా ప్రకటన'
                        : 'OFFICIAL PIB PRESS RELEASE'}
                    </span>
                    <span className="flex size-11 items-center justify-center rounded-full border-2 border-emerald-800 bg-emerald-900 text-xs font-black text-amber-300 shadow-sm">
                      PIB
                    </span>
                  </div>
                  <div className="mt-3 flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-900">
                      <ShieldCheck size={13} className="mr-1.5" aria-hidden="true" />
                      {language === 'te'
                        ? 'PIB ప్రభుత్వ ప్రచురిత ఖాతా'
                        : 'Government-Published Account (PIB)'}
                    </p>
                    <div className="my-3 h-px bg-slate-200" />
                    <p className="font-bold text-slate-950">{story.farmer_name}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {story.location_state} · {story.scheme_tag}
                    </p>
                    <p className="mt-3 text-xs leading-relaxed text-slate-700">
                      {story.pib_release_note ||
                        (language === 'te'
                          ? 'ప్రచురించిన రైతు ఖాతాలో ఉన్న వివరాలే ఇక్కడ చూపబడతాయి.'
                          : 'This preview summarizes only the details in the published account.')}
                    </p>
                  </div>
                  <a
                    href={story.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-emerald-800 bg-white px-3 py-2 text-center text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    {language === 'te'
                      ? 'అధికారిక PIB రికార్డును చూడండి ↗'
                      : 'Verify Official PIB Record ↗'}
                  </a>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                    {language === 'te'
                      ? 'ఈ మూల లింక్ PIB అధికారిక సైట్‌కు వెళ్తుంది; ప్రత్యేక విడుదల URL అందుబాటులో లేదు.'
                      : 'This source link opens the official PIB site; a release-specific URL is not provided here.'}
                  </p>
                </div>

                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border border-emerald-950 bg-gradient-to-br from-[#14532d] via-[#174b2d] to-[#0f2e20] p-4 text-white shadow-sm transition hover:shadow-lg focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                  aria-label={videoTitle}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-emerald-50">
                      {language === 'te' ? 'అధికారిక DD KISAN ఛానల్' : 'OFFICIAL DD KISAN CHANNEL'}
                    </span>
                    <ExternalLink size={16} className="text-emerald-100" aria-hidden="true" />
                  </div>
                  <div className="relative my-4 overflow-hidden rounded-xl border border-white/20 bg-emerald-950">
                    <svg
                      viewBox="0 0 420 150"
                      role="img"
                      aria-label={
                        language === 'te'
                          ? 'పంట పొలంలో రైతు ఇంటర్వ్యూ దృశ్యం'
                          : 'Illustration of a farmer interview in a crop field'
                      }
                      className="h-32 w-full"
                    >
                      <rect width="420" height="150" fill="#b9dca0" />
                      <circle cx="355" cy="33" r="20" fill="#f6bd4b" />
                      <path d="M0 75 Q88 30 180 72 T420 64 V150 H0Z" fill="#5f9a52" />
                      <path d="M0 104 Q100 73 210 105 T420 90 V150 H0Z" fill="#276b3e" />
                      <path d="M0 131 Q110 101 220 132 T420 120 V150 H0Z" fill="#174b2d" />
                      <path d="M28 150 L125 83 M78 150 L148 86 M132 150 L170 91 M220 150 L194 93 M290 150 L218 94 M360 150 L239 91" stroke="#e8bd5b" strokeWidth="4" opacity=".8" />
                      <circle cx="202" cy="76" r="12" fill="#7b4a2d" />
                      <path d="M190 71 Q202 56 214 71Z" fill="#f0b52c" />
                      <path d="M191 89 Q202 82 213 89 L218 125 H186Z" fill="#f1c65d" />
                      <path d="M192 122 L187 150 M211 122 L217 150" stroke="#243b2c" strokeWidth="7" />
                      <rect x="239" y="92" width="17" height="30" rx="3" fill="#1e293b" />
                      <circle cx="247" cy="88" r="7" fill="#1e293b" />
                      <path d="M239 100 L225 110 M256 100 L268 109" stroke="#1e293b" strokeWidth="4" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-14 items-center justify-center rounded-full bg-[#f59e0b] text-emerald-950 shadow-lg transition group-hover:scale-105">
                        <PlayCircle size={34} aria-hidden="true" />
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <p className="mt-4 text-base font-extrabold leading-snug text-white">
                      {videoTitle}
                    </p>
                    <p className="mt-2 text-xs text-emerald-100">
                      {story.video_reference_title ||
                        'DD Kisan · Ministry of Agriculture public video channel'}
                    </p>
                  </div>
                  <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-extrabold text-emerald-950">
                    {language === 'te'
                      ? 'DD Kisanలో వీడియోలు చూడండి ↗'
                      : 'Watch on DD Kisan ↗'}
                  </span>
                </a>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50/70 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                    <ShieldCheck size={16} aria-hidden="true" />
                    {language === 'te' ? 'నమోదైన వాస్తవాలు' : 'Documented Facts'}
                  </h4>
                  <dl className="mt-3 space-y-2">
                    {Object.entries(story.known_facts).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs font-semibold capitalize text-slate-600">
                          {key.replaceAll('_', ' ')}
                        </dt>
                        <dd className="text-sm leading-relaxed text-slate-800">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="rounded-xl bg-amber-50/80 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <HelpCircle size={16} aria-hidden="true" />
                    {language === 'te'
                      ? 'మూలంలో తెలియని వివరాలు'
                      : 'Unknown / Not in Source'}
                  </h4>
                  <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-700">
                    {story.unknown_facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {story.takeaway}
              </p>
              </article>
            )
          })}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
        <InfoIcon />
        <span>
          CropProof did not assist in this case. Past compensation does not guarantee eligibility.
        </span>
      </p>
    </section>
  )
}

function InfoIcon() {
  return <HelpCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
}
