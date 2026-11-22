export type CalamityType =
  | 'flood_inundation'
  | 'hailstorm'
  | 'heavy_rain'
  | 'unseasonal_rain'
  | 'post_harvest_rain'
  | 'other'

export type InsuranceStatus =
  | 'enrolled_loanee'
  | 'enrolled_non_loanee'
  | 'unsure'
  | 'not_enrolled'

export interface IncidentCase {
  id: string
  farmer_alias: string | null
  crop: string | null
  calamity_type: CalamityType | null
  incident_date: string | null
  village: string | null
  district: string | null
  state: string | null
  affected_area_acres: number | null
  insurance_status: InsuranceStatus | null
  confirmation_status: string | null
  crop_stage: string | null
  is_confirmed: number
  current_step: number
  manual_status: string | null
  acknowledgement_ref: string | null
  gps_lat: number | null
  gps_lon: number | null
  gps_accuracy_m: number | null
  weather_summary: string | null
  rainfall_mm_72h: number | null
  rainfall_source?: string | null
  weather_observed_at: string | null
  created_at: string
  dossier_id?: string | null
  dossier_generated_at?: string | null
  dossier_sha256?: string | null
  evidence?: EvidenceFile[]
}

export interface DossierIntegrity {
  dossier_id: string
  claim_id: string
  generated_at: string
  sha256_hash: string
  rainfall_mm: number | null
  rainfall_source: string
  within_72h_window: boolean | null
  reporting_status: 'within_72h_window' | 'past_72h_window' | 'unknown'
}

export interface RainfallVerification {
  precipitation_mm: number
  precipitation_sum: number
  latitude: number
  longitude: number
  queried_date: string
  source: 'open-meteo' | 'fallback_cache'
  within_72h_window: boolean
  note: string
}

export interface EvidenceFile {
  id: string
  case_id: string
  category: string | null
  file_name: string
  file_path: string
  uploaded_at: string | null
  farmer_caption: string | null
}

export interface FarmerStory {
  id: string
  farmer_name: string
  location_state: string
  publisher: string
  source_url: string
  trust_label: string
  calamity_tags: string[]
  crop_tags: string[]
  scheme_tag: string
  known_facts: Record<string, string>
  unknown_facts: string[]
  takeaway: string
  premium_paid_display?: string | null
  payout_received_display?: string | null
  pib_release_note?: string | null
  video_reference_title?: string | null
  video_reference_url?: string | null
  match_reason?: string | null
}

export interface PolicyPassage {
  id: string
  title: string
  publisher: string
  version_note: string
  source_url: string
  keywords: string[]
  text: string
  page_number?: number
}

export interface DeadlineEvaluation {
  window_hours?: number | null
  window_days?: number
  deadline_date: string | null
  status: string
  note: string
}

export interface GuidanceResponse {
  deadline_evaluation: DeadlineEvaluation
  conditional_deadline_note: string
  missing_info: {
    fields: string[]
    evidence: string[]
  }
  missing_fields: string[]
  missing_evidence: string[]
  channels: string[]
  policies: PolicyPassage[]
  matched_stories: FarmerStory[]
}
