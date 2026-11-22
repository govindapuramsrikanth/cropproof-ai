import type { CalamityType, IncidentCase } from '../types'

export type RequiredIntakeField =
  | 'crop'
  | 'calamity_type'
  | 'incident_date'
  | 'village'
  | 'district'
  | 'state'
  | 'affected_area_acres'

const calamityTypes = new Set<CalamityType>([
  'flood_inundation',
  'hailstorm',
  'heavy_rain',
  'unseasonal_rain',
  'post_harvest_rain',
  'other',
])

function isValidDate(value: string | null): boolean {
  const date = value?.slice(0, 10) ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === date
  )
}

export function getMissingRequiredIntakeFields(
  caseData: IncidentCase,
  affectedAreaValue?: string,
): RequiredIntakeField[] {
  const missing: RequiredIntakeField[] = []
  if (!caseData.crop?.trim()) missing.push('crop')
  if (
    !caseData.calamity_type ||
    !calamityTypes.has(caseData.calamity_type)
  ) {
    missing.push('calamity_type')
  }
  if (!isValidDate(caseData.incident_date)) missing.push('incident_date')
  if (!caseData.village?.trim()) missing.push('village')
  if (!caseData.district?.trim()) missing.push('district')
  if (!caseData.state?.trim()) missing.push('state')

  const areaText =
    affectedAreaValue ??
    (caseData.affected_area_acres === null
      ? ''
      : String(caseData.affected_area_acres))
  const area = Number(areaText)
  if (!Number.isFinite(area) || area <= 0) {
    missing.push('affected_area_acres')
  }

  return missing
}
