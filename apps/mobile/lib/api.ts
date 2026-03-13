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

// Singleton instance
export const api = new VeloraApiClient()

// Allow creating custom instances (e.g., for testing)
export { VeloraApiClient }
