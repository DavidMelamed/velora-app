/**
 * Velora Mobile API Client
 * Configurable base URL pointing to Express API
 */

const DEFAULT_API_URL = __DEV__
  ? 'http://localhost:4000'
  : 'https://api.velora.app'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  timeout?: number
}

interface ApiError {
  message: string
  status: number
  code?: string
}

class VeloraApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, signal, timeout = 15000 } = options

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: signal || controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: response.statusText }))
        const error: ApiError = {
          message: errorBody.message || response.statusText,
          status: response.status,
          code: errorBody.code,
        }
        throw error
      }

      return await response.json() as T
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Health
  async healthCheck() {
    return this.request<{ status: string }>('/health')
  }

  // Search
  async search(query: string, options?: { signal?: AbortSignal }) {
    return this.request<{ results: CrashSearchResult[]; total: number }>(
      '/api/search',
      { method: 'POST', body: { query }, signal: options?.signal }
    )
  }

  // Crashes
  async getCrash(id: string) {
    return this.request<CrashDetail>(`/api/crashes/${id}`)
  }

  async getNearbyCrashes(lat: number, lng: number, radiusMeters: number = 200) {
    return this.request<{ crashes: CrashSearchResult[] }>(
      `/api/crashes/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`
    )
  }

  // Equalizer
  async getEqualizer(crashId: string) {
    return this.request<EqualizerResponse>(`/api/equalizer/${crashId}`)
  }

  async generateEqualizer(crashId: string) {
    return this.request<EqualizerResponse>(
      `/api/equalizer/${crashId}`,
      { method: 'POST', timeout: 60000 }
    )
  }

  // Attorneys
  async findAttorneys(params: { lat: number; lng: number; radius?: number; specialty?: string }) {
    const qs = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
      ...(params.radius && { radius: String(params.radius) }),
      ...(params.specialty && { specialty: params.specialty }),
    })
    return this.request<{ attorneys: AttorneyResult[] }>(`/api/attorneys?${qs}`)
  }

  // Feedback
  async submitFeedback(feedback: { crashId: string; type: string; content: string }) {
    return this.request<{ success: boolean }>(
      '/api/feedback',
      { method: 'POST', body: feedback }
    )
  }

  // Pipeline / OCR
  async uploadForOcr(imageBase64: string) {
    return this.request<OcrResult>(
      '/api/pipeline/ocr',
      { method: 'POST', body: { image: imageBase64 }, timeout: 30000 }
    )
  }

  // Crash confirmation ("I was in this crash")
  async confirmCrash(crashId: string, details?: { role?: string; description?: string }) {
    return this.request<{ success: boolean; isVerified: boolean }>(
      `/api/crashes/${crashId}/confirm`,
      { method: 'POST', body: details }
    )
  }

  // ─── Case Memory ──────────────────────────────────

  async createMatter(input: { crashId?: string; accidentDate?: string; stateCode?: string; clientName?: string }) {
    return this.request<MatterResponse>('/api/case', { method: 'POST', body: input })
  }

  async getMatter(matterId: string) {
    return this.request<MatterResponse>(`/api/case/${matterId}`)
  }

  async getCaseTimeline(matterId: string, limit: number = 20) {
    return this.request<TimelineEventResponse[]>(`/api/case/${matterId}/timeline?limit=${limit}`)
  }

  async getCaseConfirmations(matterId: string) {
    return this.request<ConfirmationResponse[]>(`/api/case/${matterId}/confirmations`)
  }

  async respondToConfirmation(matterId: string, confirmationId: string, confirmed: boolean) {
    return this.request<{ success: boolean }>(
      `/api/case/${matterId}/confirm/${confirmationId}`,
      { method: 'POST', body: { confirmed } }
    )
  }

  async getChatHistory(matterId: string) {
    return this.request<ChatMessage[]>(`/api/case/${matterId}/chat/history`)
  }

  async sendChatMessage(matterId: string, messages: Array<{ role: string; content: string }>) {
    // Note: This endpoint streams SSE. For mobile, we do a simple POST and parse the final result.
    return this.request<{ role: string; content: string }>(
      `/api/case/${matterId}/chat`,
      { method: 'POST', body: { messages }, timeout: 30000 }
    )
  }

  async uploadVoiceNote(matterId: string, mediaUrl: string, transcription: string, duration: number) {
    return this.request<EpisodeResponse>(
      `/api/case/${matterId}/episodes/voice`,
      { method: 'POST', body: { mediaUrl, transcription, duration } }
    )
  }

  async uploadPhoto(matterId: string, mediaUrl: string, exif: Record<string, unknown>) {
    return this.request<EpisodeResponse>(
      `/api/case/${matterId}/episodes/photo`,
      { method: 'POST', body: { mediaUrl, exif } }
    )
  }

  async getNearbyProviders(lat: number, lng: number, radius: number = 5000) {
    return this.request<ProviderResponse[]>(
      `/api/case/providers/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
    )
  }

  /** Get the base URL for direct fetch() calls (e.g., multipart uploads) */
  getBaseUrl(): string {
    return this.baseUrl
  }
}

// Types used by the API client
export interface CrashSearchResult {
  id: string
  crashDate: string
  location: string
  severity: string | null
  vehicleCount: number
  personCount: number
  latitude: number | null
  longitude: number | null
  summary?: string
}

export interface CrashDetail {
  id: string
  crashDate: string
  crashTime: string | null
  location: string
  severity: string | null
  stateCode: string
  county: string | null
  cityName: string | null
  streetAddress: string | null
  latitude: number | null
  longitude: number | null
  mannerOfCollision: string | null
  atmosphericCondition: string | null
  lightCondition: string | null
  vehicles: VehicleInfo[]
  persons: PersonInfo[]
  narrative: NarrativeInfo | null
  isVerified: boolean
}

export interface VehicleInfo {
  id: string
  make: string | null
  model: string | null
  modelYear: number | null
  bodyType: string | null
}

export interface PersonInfo {
  id: string
  personType: string | null
  injuryStatus: string | null
  sex: string | null
}

export interface NarrativeInfo {
  headline: string
  summary: string
}

export interface EqualizerResponse {
  crashId: string
  comparable: unknown
  liability: unknown
  settlement: unknown
  attorneyMatches: unknown
}

export interface AttorneyResult {
  id: string
  name: string
  firmName: string | null
  rating: number | null
  reviewCount: number
  distance: number | null
  specialties: string[]
}

export interface OcrResult {
  success: boolean
  data: Partial<CrashDetail> | null
  confidence: number
  rawText: string | null
}

// Case Memory types
export interface MatterResponse {
  id: string
  clientName: string | null
  status: string
  accidentDate: string | null
  stateCode: string | null
  statuteDeadline: string | null
  lastActivityAt: string
}

export interface TimelineEventResponse {
  id: string
  category: string
  title: string
  description: string | null
  occurredAt: string
  duration: number | null
  isGap: boolean
  gapDays: number | null
}

export interface ConfirmationResponse {
  id: string
  prompt: string
  confirmed: boolean | null
  sentAt: string
  episodeId: string | null
  factId: string | null
  entityId: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
}

export interface EpisodeResponse {
  id: string
  type: string
  title: string | null
  occurredAt: string
}

export interface ProviderResponse {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  geofenceRadius: number
}

// Singleton instance
export const api = new VeloraApiClient()

// Allow creating custom instances (e.g., for testing)
export { VeloraApiClient }
