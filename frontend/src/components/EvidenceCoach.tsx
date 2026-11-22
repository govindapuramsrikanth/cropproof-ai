import { useState } from 'react'
import { CheckCircle2, FileText, ImagePlus, Upload } from 'lucide-react'

import {
  PhotoGuideIllustration,
  type PhotoGuideKind,
} from './AgrarianVisuals'
import { labels, type Language } from '../i18n/labels'
import { apiRequest, apiUrl } from '../lib/api'
import type { EvidenceFile, GuidanceResponse, IncidentCase } from '../types'

interface EvidenceCoachProps {
  caseData: IncidentCase
  guidance: GuidanceResponse | null
  language: Language
  onUploaded: () => void
}

const evidenceGuides = [
  {
    category: 'wide_field',
    title: 'Wide Field View',
    titleTe: 'పొలం మొత్తం కనిపించే చిత్రం',
    tip: 'Stand at the edge of the field and include the affected area and surrounding crop.',
    tipTe: 'పొలం అంచు నుంచి నష్టపోయిన భాగం, చుట్టుపక్కల పంట కనిపించేలా తీయండి.',
    kind: 'wide_field',
  },
  {
    category: 'closeup_crop',
    title: 'Close-Up of Damaged Crop',
    titleTe: 'దెబ్బతిన్న పంట దగ్గరి చిత్రం',
    tip: 'Photograph damaged leaves, stems, or produce clearly without removing them.',
    tipTe: 'ఆకులు, కాండం లేదా దిగుబడిని తొలగించకుండా దగ్గరగా స్పష్టంగా తీయండి.',
    kind: 'closeup_crop',
  },
  {
    category: 'landmark',
    title: 'Field Landmark / Bund',
    titleTe: 'పొలం గుర్తు / గట్టు',
    tip: 'Include a field bund, path, or stable landmark to help identify the location.',
    tipTe: 'స్థలాన్ని గుర్తించేందుకు పొలం గట్టు, దారి లేదా స్థిరమైన గుర్తును చూపండి.',
    kind: 'landmark',
  },
  {
    category: 'insurance_doc',
    title: 'Insurance / Bank Deduction Slip',
    titleTe: 'బీమా / బ్యాంక్ మినహాయింపు రసీదు',
    tip: 'Upload a relevant insurance document or bank premium deduction slip. Hide unrelated personal details.',
    tipTe: 'సంబంధిత బీమా పత్రం లేదా ప్రీమియం మినహాయింపు రసీదును అప్‌లోడ్ చేయండి. అవసరం లేని వ్యక్తిగత వివరాలను దాచండి.',
    kind: 'insurance_doc',
  },
] as const

function createSampleEvidenceBlob(
  category: PhotoGuideKind,
  title: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 840
  const context = canvas.getContext('2d')
  if (!context) {
    return Promise.reject(new Error('Canvas drawing is unavailable in this browser.'))
  }

  const sky = context.createLinearGradient(0, 0, 0, 470)
  sky.addColorStop(0, '#9ccbc5')
  sky.addColorStop(0.66, '#d7e5bf')
  sky.addColorStop(1, '#e8d18c')
  context.fillStyle = sky
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255, 224, 142, 0.9)'
  context.beginPath()
  context.arc(970, 155, 54, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#698c72'
  context.beginPath()
  context.moveTo(0, 380)
  context.lineTo(170, 265)
  context.lineTo(315, 355)
  context.lineTo(510, 250)
  context.lineTo(700, 360)
  context.lineTo(920, 268)
  context.lineTo(1200, 365)
  context.lineTo(1200, 840)
  context.lineTo(0, 840)
  context.closePath()
  context.fill()

  context.fillStyle = '#56804d'
  context.beginPath()
  context.moveTo(0, 405)
  context.quadraticCurveTo(440, 350, 720, 410)
  context.quadraticCurveTo(1000, 365, 1200, 425)
  context.lineTo(1200, 840)
  context.lineTo(0, 840)
  context.closePath()
  context.fill()

  const field = context.createLinearGradient(0, 430, 0, 840)
  field.addColorStop(0, '#83a94e')
  field.addColorStop(1, '#315d37')
  context.fillStyle = field
  context.beginPath()
  context.moveTo(0, 425)
  context.quadraticCurveTo(560, 390, 1200, 438)
  context.lineTo(1200, 840)
  context.lineTo(0, 840)
  context.closePath()
  context.fill()

  context.save()
  context.globalAlpha = 0.55
  for (let row = 0; row < 8; row += 1) {
    const y = 500 + row * 48
    context.beginPath()
    context.moveTo(0, y + row * 4)
    context.quadraticCurveTo(560, y - 85 + row * 8, 1200, y + row * 6)
    context.strokeStyle = row % 2 === 0 ? '#d4c77c' : '#294f32'
    context.lineWidth = row < 3 ? 5 : 8
    context.stroke()
  }
  context.restore()

  for (let row = 0; row < 6; row += 1) {
    const y = 445 + row * 54
    const scale = 0.55 + row * 0.12
    const spacing = 105 - row * 7
    for (let x = 28 + (row % 2) * 38; x < canvas.width; x += spacing) {
      const baseY = y + ((x * 7 + row * 13) % 18)
      const height = 50 * scale
      context.strokeStyle = row < 2 ? '#497844' : '#27653c'
      context.lineWidth = 4 * scale
      context.lineCap = 'round'
      context.beginPath()
      context.moveTo(x, baseY)
      context.lineTo(x + 2 * scale, baseY - height)
      context.stroke()
      for (let leaf = 0; leaf < 3; leaf += 1) {
        const direction = leaf % 2 === 0 ? -1 : 1
        context.beginPath()
        context.moveTo(x + 2 * scale, baseY - height * (0.25 + leaf * 0.16))
        context.quadraticCurveTo(
          x + direction * 13 * scale,
          baseY - height * (0.3 + leaf * 0.16),
          x + direction * 27 * scale,
          baseY - height * (0.12 + leaf * 0.12),
        )
        context.strokeStyle = leaf === 1 ? '#82a83f' : '#3d853f'
        context.lineWidth = 3 * scale
        context.stroke()
      }
    }
  }

  if (category === 'insurance_doc') {
    context.fillStyle = 'rgba(22, 38, 27, 0.28)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#fffdf3'
    context.fillRect(390, 135, 420, 510)
    context.strokeStyle = '#587a56'
    context.lineWidth = 8
    context.strokeRect(390, 135, 420, 510)
    context.fillStyle = '#285a35'
    context.font = 'bold 30px sans-serif'
    context.fillText('SAMPLE INSURANCE SLIP', 430, 198)
    context.fillStyle = '#506353'
    context.font = '22px sans-serif'
    context.fillText('Demonstration document — no real account data', 430, 244)
    for (let line = 0; line < 6; line += 1) {
      context.fillRect(430, 290 + line * 42, 320 - (line % 3) * 48, 5)
    }
    context.strokeStyle = '#c39128'
    context.lineWidth = 5
    context.strokeRect(430, 560, 170, 44)
    context.fillStyle = '#8b5e13'
    context.font = 'bold 20px sans-serif'
    context.fillText('SAMPLE ONLY', 447, 589)
  } else if (category === 'closeup_crop') {
    context.strokeStyle = '#3e793e'
    context.lineWidth = 18
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(580, 820)
    context.quadraticCurveTo(605, 600, 580, 395)
    context.stroke()
    context.fillStyle = '#a47a37'
    context.beginPath()
    context.ellipse(580, 390, 46, 90, 0, 0, Math.PI * 2)
    context.fill()
    for (let line = 0; line < 7; line += 1) {
      context.strokeStyle = '#dfbc67'
      context.lineWidth = 7
      context.beginPath()
      context.moveTo(548 + line * 10, 328)
      context.lineTo(548 + line * 10, 452)
      context.stroke()
    }
    context.strokeStyle = '#397744'
    context.lineWidth = 16
    for (const direction of [-1, 1]) {
      context.beginPath()
      context.moveTo(580, 590)
      context.quadraticCurveTo(580 + direction * 175, 450, 580 + direction * 260, 500)
      context.quadraticCurveTo(580 + direction * 190, 635, 580, 590)
      context.fillStyle = direction < 0 ? '#6d9d4d' : '#80a951'
      context.fill()
      context.stroke()
    }
  } else if (category === 'landmark') {
    context.fillStyle = '#d7b16d'
    context.fillRect(150, 355, 115, 115)
    context.fillStyle = '#986746'
    context.beginPath()
    context.moveTo(130, 360)
    context.lineTo(208, 295)
    context.lineTo(285, 360)
    context.closePath()
    context.fill()
    context.fillStyle = '#715039'
    context.fillRect(192, 407, 34, 63)
    context.strokeStyle = '#386641'
    context.lineWidth = 12
    context.beginPath()
    context.moveTo(1000, 435)
    context.lineTo(1000, 300)
    context.stroke()
    context.fillStyle = '#428044'
    context.beginPath()
    context.arc(1000, 290, 67, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#c7a969'
    context.fillRect(0, 490, 1200, 18)
  }

  context.fillStyle = 'rgba(14, 33, 22, 0.78)'
  context.fillRect(0, 735, canvas.width, 105)
  context.fillStyle = '#ffffff'
  context.font = 'bold 28px sans-serif'
  context.fillText(title.toUpperCase(), 42, 777)
  context.fillStyle = '#ffe08a'
  context.font = 'bold 21px sans-serif'
  context.fillText('ILLUSTRATIVE SAMPLE — NOT A REAL FIELD PHOTOGRAPH', 42, 817)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The sample image could not be generated.'))
    }, 'image/png')
  })
}

function evidenceUrl(caseId: string, evidence: EvidenceFile): string {
  const storedName =
    evidence.file_path.split(/[\\/]/).pop() || evidence.file_name
  return apiUrl(
    `/uploads/${encodeURIComponent(caseId)}/${encodeURIComponent(storedName)}`,
  )
}

function isImage(fileName: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(fileName)
}

export function EvidenceCoach({
  caseData,
  guidance,
  language,
  onUploaded,
}: EvidenceCoachProps) {
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [sampleLoadingCategory, setSampleLoadingCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = labels[language]
  const evidence = caseData.evidence ?? []
  const hasCropPhoto = evidence.some(
    (item) =>
      ['wide_field', 'closeup_crop', 'landmark'].includes(
        item.category?.toLowerCase() ?? '',
      ) || isImage(item.file_name),
  )
  const hasInsuranceDocument = evidence.some(
    (item) => item.category?.toLowerCase() === 'insurance_doc',
  )
  const missingEvidence = (
    guidance?.missing_info.evidence ??
    guidance?.missing_evidence ??
    []
  ).filter((item) => {
    const value = item.toLowerCase()
    if (value.includes('photo') || value.includes('photograph')) {
      return !hasCropPhoto
    }
    if (value.includes('insurance') || value.includes('policy')) {
      return !hasInsuranceDocument
    }
    return true
  })

  const uploadEvidence = async (
    category: string,
    fileOverride?: File,
    captionOverride?: string,
  ) => {
    const file = fileOverride ?? files[category]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', category)
    formData.append(
      'user_caption',
      captionOverride ?? captions[category] ?? '',
    )
    setUploadingCategory(category)
    setError(null)
    try {
      await apiRequest<EvidenceFile>(`/api/cases/${caseData.id}/evidence`, {
        method: 'POST',
        body: formData,
      })
      setFiles((current) => ({ ...current, [category]: null }))
      setCaptions((current) => ({ ...current, [category]: '' }))
      onUploaded()
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to upload evidence.',
      )
    } finally {
      setUploadingCategory(null)
    }
  }

  const uploadSamplePhoto = async (
    category: PhotoGuideKind,
    title: string,
  ) => {
    setSampleLoadingCategory(category)
    setError(null)
    try {
      const blob = await createSampleEvidenceBlob(category, title)
      const file = new File([blob], `sample-${category}.png`, {
        type: 'image/png',
      })
      const caption =
        language === 'te'
          ? 'పరీక్ష కోసం రూపొందించిన ఉదాహరణ చిత్రం; ఈ పొలం నిజమైన ఫోటో కాదు.'
          : 'Generated illustration for testing; not a photograph of this field.'
      await uploadEvidence(category, file, caption)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to create the sample field image.',
      )
    } finally {
      setSampleLoadingCategory(null)
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="evidence-coach-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {language === 'te' ? 'దశ 4 · ఆధారాల అప్‌లోడ్' : 'Step 4 · Evidence upload'}
        </p>
        <h2
          id="evidence-coach-title"
          className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          {language === 'te' ? 'మంచి ఆధారాలను సేకరించండి' : 'Build a clear evidence record'}
        </h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          {language === 'te'
            ? 'ప్రతి చిత్రానికి స్థలం, తేదీ, ఏమి కనిపిస్తుందో వివరించే శీర్షికను జోడించండి.'
            : 'Add a short caption describing where, when, and what each file shows.'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {evidenceGuides.map((guide, index) => {
          const uploaded = evidence.filter(
            (item) => item.category === guide.category,
          )
          const fileId = `evidence-file-${guide.category}`
          const captionId = `evidence-caption-${guide.category}`
          return (
            <article
              key={guide.category}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-extrabold text-emerald-800">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {language === 'te' ? guide.titleTe : guide.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {language === 'te' ? guide.tipTe : guide.tip}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <PhotoGuideIllustration
                  kind={guide.kind}
                  language={language}
                />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label
                    htmlFor={fileId}
                    className="block text-sm font-semibold text-slate-700"
                  >
                    {language === 'te' ? 'ఫోటో లేదా PDF ఎంచుకోండి' : 'Choose a photo or PDF'}
                  </label>
                  <input
                    id={fileId}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) =>
                      setFiles((current) => ({
                        ...current,
                        [guide.category]: event.target.files?.[0] ?? null,
                      }))
                    }
                    className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:font-semibold file:text-emerald-800"
                  />
                </div>
                <div>
                  <label
                    htmlFor={captionId}
                    className="block text-sm font-semibold text-slate-700"
                  >
                    {language === 'te' ? 'రైతు శీర్షిక' : 'Farmer caption'}
                  </label>
                  <input
                    id={captionId}
                    value={captions[guide.category] ?? ''}
                    onChange={(event) =>
                      setCaptions((current) => ({
                        ...current,
                        [guide.category]: event.target.value,
                      }))
                    }
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    placeholder={
                      language === 'te'
                        ? 'ఈ ఫైల్‌లో ఏమి కనిపిస్తుంది?'
                        : 'What does this file show?'
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="truncate text-sm text-slate-500">
                  {files[guide.category]?.name ??
                    (language === 'te' ? 'ఫైల్ ఎంచుకోలేదు' : 'No file selected')}
                </p>
                <button
                  type="button"
                  disabled={
                    !files[guide.category] ||
                    uploadingCategory !== null ||
                    sampleLoadingCategory !== null
                  }
                  onClick={() => void uploadEvidence(guide.category)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {uploadingCategory === guide.category ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Upload size={16} aria-hidden="true" />
                  )}
                  {language === 'te' ? 'అప్‌లోడ్ చేయండి' : 'Upload evidence'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="max-w-md text-xs leading-relaxed text-amber-950">
                  {copy.samplePhotoDisclaimer}
                </p>
                <button
                  type="button"
                  disabled={
                    uploadingCategory !== null ||
                    sampleLoadingCategory !== null
                  }
                  onClick={() =>
                    void uploadSamplePhoto(guide.kind, guide.title)
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-700 bg-white px-3 py-2 text-sm font-bold text-amber-950 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                >
                  {sampleLoadingCategory === guide.category ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-900" />
                  ) : (
                    <ImagePlus size={16} aria-hidden="true" />
                  )}
                  {sampleLoadingCategory === guide.category
                    ? copy.samplePhotoLoading
                    : copy.samplePhoto}
                </button>
              </div>

              {uploaded.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 size={17} aria-hidden="true" />
                    {language === 'te' ? 'అప్‌లోడ్ చేసిన ఆధారాలు' : 'Uploaded evidence'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {uploaded.map((item) => (
                      <a
                        key={item.id}
                        href={evidenceUrl(caseData.id, item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex max-w-full items-center gap-3 rounded-xl border border-slate-200 p-2 transition hover:border-emerald-400 hover:bg-emerald-50"
                      >
                        {isImage(item.file_name) ? (
                          <img
                            src={evidenceUrl(caseData.id, item)}
                            alt={item.farmer_caption || item.file_name}
                            className="size-16 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex size-16 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <FileText size={24} aria-hidden="true" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block max-w-48 truncate text-sm font-semibold text-slate-800">
                            {item.file_name}
                          </span>
                          <span className="mt-1 block max-w-48 truncate text-xs text-slate-500">
                            {item.farmer_caption ||
                              (language === 'te' ? 'శీర్షిక లేదు' : 'No caption')}
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <section
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        aria-labelledby="missing-checklist-title"
      >
        <h3 id="missing-checklist-title" className="font-bold text-amber-950">
          {language === 'te'
            ? 'ఇంకా అవసరమైన సమాచారం'
            : 'Live missing information checklist'}
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
              {language === 'te' ? 'వివరాలు' : 'Information'}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
              {(guidance?.missing_info.fields ?? []).length ? (
                guidance?.missing_info.fields.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 rounded-full bg-amber-700" />
                    {item}
                  </li>
                ))
              ) : (
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {language === 'te' ? 'కనిపించే లోటు లేదు' : 'No missing fields'}
                </li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
              {language === 'te' ? 'ఆధారాలు' : 'Evidence'}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-950">
              {missingEvidence.length ? (
                missingEvidence.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 rounded-full bg-amber-700" />
                    {item}
                  </li>
                ))
              ) : (
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {language === 'te' ? 'కనిపించే లోటు లేదు' : 'No missing evidence'}
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs leading-relaxed text-slate-500">
        <ImagePlus size={15} aria-hidden="true" />
        {language === 'te'
          ? 'ఈ ఆధారాలు రైతు సమర్పించినవి; CropProof వాటి నిజానిజాలను ధృవీకరించదు.'
          : 'Evidence is farmer-submitted; CropProof does not verify its authenticity.'}
      </div>
    </section>
  )
}
