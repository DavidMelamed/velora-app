/**
 * DataForSEO Google Maps API Adapter
 *
 * Searches Google Maps for personal injury lawyers by location,
 * fetches business profiles and reviews.
 *
 * API docs: https://docs.dataforseo.com/v3/business_data/google/reviews/
 *
 * Two-step process:
 *   1. Google Maps Search → discover lawyer listings (place_id, name, address, rating)
 *   2. Google Reviews Task → fetch all reviews for each place_id
 */

export interface DataForSEOConfig {
  login: string
  password: string
  /** Max concurrent requests */
  concurrency?: number
  /** Delay between requests in ms */
  rateLimitMs?: number
}

export interface GoogleMapsListing {
  placeId: string
  title: string
  rating: number | null
  reviewCount: number
  address: string | null
  phone: string | null
  website: string | null
  latitude: number | null
  longitude: number | null
  category: string | null
  workHours: Record<string, string> | null
  url: string | null
}

export interface GoogleReviewItem {
  reviewId: string
  authorName: string | null
  rating: number
  text: string | null
  publishedAt: Date | null
  language: string | null
}

export interface AttorneySearchResult {
  listing: GoogleMapsListing
  reviews: GoogleReviewItem[]
}

const API_BASE = 'https://api.dataforseo.com/v3'

function makeAuthHeader(config: DataForSEOConfig): string {
  return 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64')
}

async function apiRequest<T>(
  config: DataForSEOConfig,
  endpoint: string,
  body: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': makeAuthHeader(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

/**
 * Search Google Maps for personal injury lawyers in a specific location.
 * Uses the Business Data → Google → My Business → Search Live endpoint.
 */
export async function searchAttorneys(
  config: DataForSEOConfig,
  query: string,
  locationName: string,
  limit: number = 20
): Promise<GoogleMapsListing[]> {
  interface MapsSearchResponse {
    status_code: number
    tasks: Array<{
      status_code: number
      result: Array<{
        items: Array<{
          place_id?: string
          title?: string
          rating?: { value?: number; votes_count?: number }
          address?: string
          phone?: string
          url?: string
          website?: string
          latitude?: number
          longitude?: number
          category?: string
          work_hours?: Record<string, string>
        }>
      }>
    }>
  }

  const data = await apiRequest<MapsSearchResponse>(
    config,
    '/business_data/google/my_business/search/live',
    [{
      keyword: query,
      location_name: locationName,
      language_code: 'en',
      limit,
    }]
  )

  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    console.warn(`[DataForSEO] Search failed for "${query}" in ${locationName}: ${task?.status_code}`)
    return []
  }

  const items = task.result?.[0]?.items ?? []

  return items
    .filter((item) => item.place_id)
    .map((item) => ({
      placeId: item.place_id!,
      title: item.title ?? 'Unknown',
      rating: item.rating?.value ?? null,
      reviewCount: item.rating?.votes_count ?? 0,
      address: item.address ?? null,
      phone: item.phone ?? null,
      website: item.website ?? null,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      category: item.category ?? null,
      workHours: item.work_hours ?? null,
      url: item.url ?? null,
    }))
}

/**
 * Fetch Google reviews for a specific place_id.
 * Uses Business Data → Google → Reviews → Live endpoint.
 */
export async function fetchReviews(
  config: DataForSEOConfig,
  placeId: string,
  limit: number = 100
): Promise<GoogleReviewItem[]> {
  interface ReviewsResponse {
    status_code: number
    tasks: Array<{
      status_code: number
      result: Array<{
        items: Array<{
          review_id?: string
          author_name?: string
          rating?: { value?: number }
          review_text?: string
          time_ago?: string
          timestamp?: string
          original_language?: string
        }>
      }>
    }>
  }

  const data = await apiRequest<ReviewsResponse>(
    config,
    '/business_data/google/reviews/live',
    [{
      place_id: placeId,
      limit,
      sort_by: 'newest',
      language_code: 'en',
    }]
  )

  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    console.warn(`[DataForSEO] Reviews failed for place ${placeId}: ${task?.status_code}`)
    return []
  }

  const items = task.result?.[0]?.items ?? []

  return items.map((item) => ({
    reviewId: item.review_id ?? `dfs-${placeId}-${Math.random().toString(36).slice(2)}`,
    authorName: item.author_name ?? null,
    rating: item.rating?.value ?? 3,
    text: item.review_text ?? null,
    publishedAt: item.timestamp ? new Date(item.timestamp) : null,
    language: item.original_language ?? 'en',
  }))
}

/**
 * Full pipeline: search for attorneys in a location, then fetch reviews for each.
 */
export async function discoverAttorneysWithReviews(
  config: DataForSEOConfig,
  location: { city: string; stateCode: string; stateName: string },
  options: {
    searchQueries?: string[]
    maxListings?: number
    maxReviewsPerListing?: number
  } = {}
): Promise<AttorneySearchResult[]> {
  const {
    searchQueries = [
      'personal injury lawyer',
      'car accident attorney',
      'auto accident lawyer',
    ],
    maxListings = 20,
    maxReviewsPerListing = 100,
  } = options

  const rateLimitMs = config.rateLimitMs ?? 500
  const locationName = `${location.city}, ${location.stateName}, United States`

  // Deduplicate across search queries by placeId
  const seenPlaceIds = new Set<string>()
  const allListings: GoogleMapsListing[] = []

  for (const query of searchQueries) {
    console.log(`[DataForSEO] Searching "${query}" in ${locationName}`)
    const listings = await searchAttorneys(config, query, locationName, maxListings)

    for (const listing of listings) {
      if (!seenPlaceIds.has(listing.placeId)) {
        seenPlaceIds.add(listing.placeId)
        allListings.push(listing)
      }
    }

    await sleep(rateLimitMs)
  }

  console.log(`[DataForSEO] Found ${allListings.length} unique listings in ${location.city}, ${location.stateCode}`)

  // Fetch reviews for each listing
  const results: AttorneySearchResult[] = []

  for (const listing of allListings) {
    if (listing.reviewCount === 0) {
      results.push({ listing, reviews: [] })
      continue
    }

    const reviews = await fetchReviews(config, listing.placeId, maxReviewsPerListing)
    results.push({ listing, reviews })

    await sleep(rateLimitMs)
  }

  return results
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Top cities per state for attorney discovery.
 * Covers major metro areas where most PI lawyers practice.
 */
export const TOP_CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Fresno', 'Oakland'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'],
  CT: ['Hartford', 'New Haven', 'Bridgeport', 'Stamford'],
  DE: ['Wilmington', 'Dover'],
  FL: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'West Palm Beach'],
  GA: ['Atlanta', 'Savannah', 'Augusta', 'Columbus'],
  HI: ['Honolulu'],
  ID: ['Boise', 'Meridian'],
  IL: ['Chicago', 'Springfield', 'Rockford', 'Naperville'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport'],
  KS: ['Wichita', 'Kansas City', 'Topeka'],
  KY: ['Louisville', 'Lexington', 'Bowling Green'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport'],
  ME: ['Portland', 'Bangor'],
  MD: ['Baltimore', 'Bethesda', 'Silver Spring', 'Annapolis'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
  MI: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester'],
  MS: ['Jackson', 'Gulfport', 'Hattiesburg'],
  MO: ['Kansas City', 'St. Louis', 'Springfield'],
  MT: ['Billings', 'Missoula', 'Great Falls'],
  NE: ['Omaha', 'Lincoln'],
  NV: ['Las Vegas', 'Reno', 'Henderson'],
  NH: ['Manchester', 'Concord', 'Nashua'],
  NJ: ['Newark', 'Jersey City', 'Trenton', 'Cherry Hill'],
  NM: ['Albuquerque', 'Santa Fe', 'Las Cruces'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro'],
  ND: ['Fargo', 'Bismarck'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Dayton'],
  OK: ['Oklahoma City', 'Tulsa'],
  OR: ['Portland', 'Eugene', 'Salem'],
  PA: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown'],
  RI: ['Providence', 'Warwick'],
  SC: ['Charleston', 'Columbia', 'Greenville'],
  SD: ['Sioux Falls', 'Rapid City'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  TX: ['Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 'El Paso'],
  UT: ['Salt Lake City', 'Provo', 'Ogden'],
  VT: ['Burlington', 'Montpelier'],
  VA: ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington'],
  WA: ['Seattle', 'Tacoma', 'Spokane', 'Bellevue'],
  WV: ['Charleston', 'Huntington'],
  WI: ['Milwaukee', 'Madison', 'Green Bay'],
  WY: ['Cheyenne', 'Casper'],
  DC: ['Washington'],
}
