// ╔══════════════════════════════════════════════════╗
// ║  CASE MEMORY SYSTEM TYPES                        ║
// ╚══════════════════════════════════════════════════╝

// ─── Enums (mirror Prisma) ──────────────────────────

export enum MatterStatus {
  INTAKE = 'INTAKE',
  ACTIVE = 'ACTIVE',
  TREATING = 'TREATING',
  DEMAND_PREP = 'DEMAND_PREP',
  LITIGATION = 'LITIGATION',
  SETTLED = 'SETTLED',
  CLOSED = 'CLOSED',
}

export enum EpisodeType {
  CALL_TRANSCRIPT = 'CALL_TRANSCRIPT',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  VOICE_NOTE = 'VOICE_NOTE',
  LOCATION_VISIT = 'LOCATION_VISIT',
  PHOTO = 'PHOTO',
  DOCUMENT = 'DOCUMENT',
  EMAIL_EXTRACT = 'EMAIL_EXTRACT',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  CONFIRMATION_RESPONSE = 'CONFIRMATION_RESPONSE',
}

export enum CaseEntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  FACILITY = 'FACILITY',
  INJURY = 'INJURY',
  BODY_PART = 'BODY_PART',
  MEDICATION = 'MEDICATION',
  CLAIM = 'CLAIM',
  VEHICLE_ENTITY = 'VEHICLE_ENTITY',
  POLICY = 'POLICY',
  APPOINTMENT = 'APPOINTMENT',
  EXPENSE = 'EXPENSE',
}

export enum FactStatus {
  CANDIDATE = 'CANDIDATE',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  SUPERSEDED = 'SUPERSEDED',
}

// ─── Summary Types (for API responses) ──────────────

export interface MatterSummary {
  id: string
  clientName: string | null
  status: MatterStatus
  accidentDate: string | null
  stateCode: string | null
  statuteDeadline: string | null
  crashId: string | null
  attorneyId: string | null
  lastActivityAt: string
  createdAt: string
  episodeCount?: number
  entityCount?: number
  factCount?: number
}

export interface EpisodeSummary {
  id: string
  type: EpisodeType
  title: string | null
  occurredAt: string
  locationName: string | null
  duration: number | null
  isProcessed: boolean
  textContent?: string | null
  mediaUrl?: string | null
}

export interface CaseEntitySummary {
  id: string
  type: CaseEntityType
  name: string
  attributes: Record<string, unknown>
  confidence: number
  sourceEpisodeIds: string[]
}

export interface CaseFactSummary {
  id: string
  subject: string
  predicate: string
  object: string
  validFrom: string
  validUntil: string | null
  status: FactStatus
  confidence: number
  sourceEpisodeIds: string[]
}

export interface TimelineEvent {
  id: string
  category: string
  title: string
  description: string | null
  occurredAt: string
  duration: number | null
  isGap: boolean
  gapDays: number | null
  episodeId: string | null
  metadata?: Record<string, unknown> | null
}

export interface ConfirmationCard {
  id: string
  prompt: string
  confirmed: boolean | null
  sentAt: string
  respondedAt: string | null
  episodeId: string | null
  factId: string | null
  entityId: string | null
}

// ─── Input Types ────────────────────────────────────

export interface MatterCreateInput {
  crashId?: string
  accidentDate?: string
  stateCode?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  userId?: string
}

export interface EpisodeCreateInput {
  type: EpisodeType
  textContent?: string
  mediaUrl?: string
  mediaType?: string
  metadata?: Record<string, unknown>
  latitude?: number
  longitude?: number
  locationName?: string
  occurredAt: string
  duration?: number
  title?: string
}

export interface ConfirmationResponse {
  confirmed: boolean
}

// ─── Filter Types ───────────────────────────────────

export interface TimelineFilter {
  category?: string
  dateFrom?: string
  dateTo?: string
}

export interface CaseSearchQuery {
  matterId: string
  query: string
  episodeTypes?: EpisodeType[]
}

// ─── Provider Type ──────────────────────────────────

export interface ProviderSummary {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  address: string | null
  phone: string | null
  geofenceRadius: number
}
