import type { AttorneyReview } from './review-intelligence'
import { getRedis } from '../lib/redis'

const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 hours
const CACHE_PREFIX = 'gplaces:'

// In-memory cache fallback when Redis is unavailable
const memoryCache = new Map<string, { data: AttorneyReview[]; expiresAt: number }>()

/**
 * Fetch attorney reviews from Google Places API.
 * Falls back gracefully if GOOGLE_PLACES_API_KEY is not set.
 * Caches results in Redis if available, otherwise in-memory Map with 24h TTL.
 */
export async function fetchAttorneyReviews(
  googlePlaceId: string
): Promise<AttorneyReview[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return []
  }

  // Check cache first
  const cached = await getCachedReviews(googlePlaceId)
  if (cached) return cached

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(googlePlaceId)}&fields=reviews&key=${process.env.GOOGLE_PLACES_API_KEY}`

    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[GooglePlaces] HTTP ${response.status} for place ${googlePlaceId}`)
      return []
    }

    const data = (await response.json()) as GooglePlacesResponse
    if (data.status !== 'OK' || !data.result?.reviews) {
      return []
    }

    const reviews: AttorneyReview[] = data.result.reviews.map(
      (review: GoogleReview, index: number) => ({
        id: `gp-${googlePlaceId}-${index}`,
        text: review.text || null,
        rating: review.rating,
        publishedAt: review.time ? new Date(review.time * 1000) : null,
        authorName: review.author_name || null,
      })
    )

    // Cache results
    await setCachedReviews(googlePlaceId, reviews)

    return reviews
  } catch (error) {
    console.error('[GooglePlaces] Failed to fetch reviews:', error)
    return []
  }
}

async function getCachedReviews(placeId: string): Promise<AttorneyReview[] | null> {
  const redis = getRedis()

  if (redis) {
    try {
      const cached = await redis.get(`${CACHE_PREFIX}${placeId}`)
      if (cached) {
        const parsed = JSON.parse(cached) as AttorneyReview[]
        // Restore Date objects
        return parsed.map((r) => ({
          ...r,
          publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
        }))
      }
    } catch {
      // Redis error — fall through to memory cache
    }
  }

  // In-memory fallback
  const entry = memoryCache.get(placeId)
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data
  }

  // Clean expired entry
  if (entry) {
    memoryCache.delete(placeId)
  }

  return null
}

async function setCachedReviews(
  placeId: string,
  reviews: AttorneyReview[]
): Promise<void> {
  const redis = getRedis()

  if (redis) {
    try {
      await redis.setex(
        `${CACHE_PREFIX}${placeId}`,
        CACHE_TTL_SECONDS,
        JSON.stringify(reviews)
      )
      return
    } catch {
      // Redis error — fall through to memory cache
    }
  }

  // In-memory fallback
  memoryCache.set(placeId, {
    data: reviews,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  })
}

// Google Places API response types
interface GoogleReview {
  author_name?: string
  rating: number
  text?: string
  time?: number
  language?: string
}

interface GooglePlacesResponse {
  status: string
  result?: {
    reviews?: GoogleReview[]
  }
}
