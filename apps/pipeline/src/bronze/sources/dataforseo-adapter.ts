/**
 * DataForSEO Google Business Data API Adapter
 *
 * Three endpoints used:
 *   1. Google My Business Search → discover lawyer listings
 *   2. Google My Business Info  → full business profile (logo, hours, attributes, etc.)
 *   3. Google Reviews Live      → all reviews with extended fields
 *
 * API docs: https://docs.dataforseo.com/v3/business_data/
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface DataForSEOConfig {
  login: string
  password: string
  rateLimitMs?: number
}

/** Full Google Business Profile data */
export interface GoogleBusinessProfile {
  placeId: string
  cid: string | null
  title: string
  description: string | null
  category: string | null
  categoryIds: string[]
  additionalCategories: string[]
  address: string | null
  addressInfo: Record<string, string> | null
  phone: string | null
  website: string | null
  domain: string | null
  latitude: number | null
  longitude: number | null
  logoUrl: string | null
  mainImageUrl: string | null
  totalPhotos: number
  isClaimed: boolean
  rating: number | null
  reviewCount: number
  ratingDistribution: Record<string, number> | null
  workHours: Record<string, unknown> | null
  attributes: Record<string, unknown> | null
  peopleAlsoSearch: Array<{ cid: string; title: string; rating?: unknown }> | null
  googleMapsUrl: string | null
  contactInfo: Array<{ type: string; value: string; source: string }> | null
}

/** Full Google Review with all extended fields */
export interface GoogleReviewFull {
  reviewId: string
  rating: number
  text: string | null
  reviewUrl: string | null
  originalReviewUrl: string | null
  authorName: string | null
  authorImageUrl: string | null
  authorProfileUrl: string | null
  timeAgo: string | null
  publishedAt: Date | null
  language: string | null
  isLocalGuide: boolean
  photosCount: number
  images: Array<{ image_url: string; alt?: string }> | null
  ownerResponse: string | null
  ownerResponseTimestamp: string | null
}

export interface AttorneySearchResult {
  profile: GoogleBusinessProfile
  reviews: GoogleReviewFull[]
}

// ═══════════════════════════════════════════════════════════
// API Helpers
// ═══════════════════════════════════════════════════════════

const API_BASE = 'https://api.dataforseo.com/v3'

function makeAuthHeader(config: DataForSEOConfig): string {
  return 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64')
}

async function apiPost<T>(config: DataForSEOConfig, endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': makeAuthHeader(config),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`DataForSEO ${response.status} ${response.statusText} on ${endpoint}`)
  }

  return response.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ═══════════════════════════════════════════════════════════
// Step 1: SERP Google Maps — discover lawyer listings
// Uses /v3/serp/google/maps/live/advanced
// ═══════════════════════════════════════════════════════════

export async function searchGoogleMaps(
  config: DataForSEOConfig,
  query: string,
  locationName: string,
  depth: number = 20
): Promise<Array<{ placeId: string; cid: string | null; title: string; reviewCount: number }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await apiPost<any>(config, '/serp/google/maps/live/advanced', [{
    keyword: query,
    location_name: locationName,
    language_code: 'en',
    depth,
  }])

  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    console.warn(`[DataForSEO] Maps search failed for "${query}" in ${locationName}: ${task?.status_code} ${task?.status_message}`)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = task.result?.[0]?.items ?? []

  return items
    .filter((item: { type?: string }) => item.type === 'maps_search')
    .filter((item: { place_id?: string }) => item.place_id)
    .map((item: { place_id?: string; cid?: string; title?: string; rating?: { value?: number; votes_count?: number } }) => ({
      placeId: item.place_id!,
      cid: item.cid ?? null,
      title: item.title ?? 'Unknown',
      reviewCount: item.rating?.votes_count ?? 0,
    }))
}

// ═══════════════════════════════════════════════════════════
// Step 2: Google My Business Info — full profile
// ═══════════════════════════════════════════════════════════

export async function fetchBusinessProfile(
  config: DataForSEOConfig,
  keyword: string,
  locationName: string
): Promise<GoogleBusinessProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await apiPost<any>(config, '/business_data/google/my_business_info/live', [{
    keyword,
    location_name: locationName,
    language_code: 'en',
  }])

  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000 || !task.result?.[0]?.items?.[0]) {
    return null
  }

  const item = task.result[0].items[0]

  return mapToProfile(item)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapToProfile(item: any): GoogleBusinessProfile {
  return {
    placeId: item.place_id ?? '',
    cid: item.cid ?? null,
    title: item.title ?? 'Unknown',
    description: item.description ?? null,
    category: item.category ?? null,
    categoryIds: Array.isArray(item.category_ids) ? item.category_ids : [],
    additionalCategories: Array.isArray(item.additional_categories) ? item.additional_categories : [],
    address: item.address ?? null,
    addressInfo: item.address_info ?? null,
    phone: item.phone ?? null,
    website: item.url ?? null,
    domain: item.domain ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    logoUrl: item.logo ?? null,
    mainImageUrl: item.main_image ?? null,
    totalPhotos: item.total_photos ?? 0,
    isClaimed: item.is_claimed ?? false,
    rating: item.rating?.value ?? null,
    reviewCount: item.rating?.votes_count ?? 0,
    ratingDistribution: item.rating_distribution ?? null,
    workHours: item.work_time ?? null,
    attributes: item.attributes ?? null,
    peopleAlsoSearch: item.people_also_search ?? null,
    googleMapsUrl: item.check_url ?? null,
    contactInfo: item.contact_info ?? null,
  }
}

// ═══════════════════════════════════════════════════════════
// Step 3: Google Reviews — async task_post / task_get
// (reviews/live is not available on this plan)
// ═══════════════════════════════════════════════════════════

/** Post a review task and return the task ID */
export async function postReviewTask(
  config: DataForSEOConfig,
  keyword: string,
  locationName: string,
  depth: number = 100,
  tag?: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await apiPost<any>(config, '/business_data/google/reviews/task_post', [{
    keyword,
    location_name: locationName,
    language_code: 'en',
    depth,
    sort_by: 'newest',
    tag: tag ?? undefined,
  }])

  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20100 || !task.id) {
    console.warn(`[DataForSEO] Review task_post failed: ${task?.status_code} ${task?.status_message}`)
    return null
  }

  return task.id as string
}

/** Fetch completed review task results */
export async function getReviewTaskResult(
  config: DataForSEOConfig,
  taskId: string
): Promise<{ reviews: GoogleReviewFull[]; title: string; placeId: string; rating: number; reviewCount: number } | 'pending' | null> {
  const response = await fetch(`${API_BASE}/business_data/google/reviews/task_get/${taskId}`, {
    method: 'GET',
    headers: { 'Authorization': makeAuthHeader(config) },
  })

  if (!response.ok) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as any
  const task = data.tasks?.[0]
  if (!task) return null

  // Still processing
  if (task.status_code === 40602 || task.status_code === 40601) return 'pending'
  // No results
  if (task.status_code === 40102) return null
  // Error
  if (task.status_code !== 20000) return null

  const result = task.result?.[0]
  if (!result) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = result.items ?? []

  const reviews: GoogleReviewFull[] = items.map((item: Record<string, unknown>) => ({
    reviewId: (item.review_id as string) ?? `dfs-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    rating: (item.rating as { value?: number })?.value ?? 3,
    text: (item.review_text as string) ?? null,
    reviewUrl: (item.review_url as string) ?? null,
    originalReviewUrl: (item.original_review_url as string) ?? null,
    authorName: (item.profile_name as string) ?? null,
    authorImageUrl: (item.profile_image_url as string) ?? null,
    authorProfileUrl: (item.profile_url as string) ?? null,
    timeAgo: (item.time_ago as string) ?? null,
    publishedAt: item.timestamp ? new Date(item.timestamp as string) : null,
    language: (item.original_language as string) ?? 'en',
    isLocalGuide: (item.local_guide as boolean) ?? false,
    photosCount: (item.photos_count as number) ?? 0,
    images: (item.images as Array<{ image_url: string; alt?: string }>) ?? null,
    ownerResponse: (item.owner_answer as string) ?? null,
    ownerResponseTimestamp: (item.owner_timestamp as string) ?? null,
  }))

  return {
    reviews,
    title: result.title ?? '',
    placeId: result.place_id ?? '',
    rating: result.rating?.value ?? 0,
    reviewCount: result.reviews_count ?? 0,
  }
}

/** Post review tasks in batch then poll until all complete */
export async function fetchReviewsBatch(
  config: DataForSEOConfig,
  listings: Array<{ title: string; placeId: string; reviewCount: number }>,
  locationName: string,
  depth: number = 100
): Promise<Map<string, GoogleReviewFull[]>> {
  const rateLimitMs = config.rateLimitMs ?? 500
  const results = new Map<string, GoogleReviewFull[]>()

  // Post all review tasks
  const taskMap = new Map<string, string>() // taskId -> placeId
  for (const listing of listings) {
    if (listing.reviewCount === 0) {
      results.set(listing.placeId, [])
      continue
    }

    const keyword = `${listing.title} ${locationName.split(',')[0]}`
    const taskId = await postReviewTask(config, keyword, locationName, depth, listing.placeId)
    if (taskId) {
      taskMap.set(taskId, listing.placeId)
    }
    await sleep(rateLimitMs)
  }

  if (taskMap.size === 0) return results

  console.log(`[DataForSEO] Posted ${taskMap.size} review tasks, waiting for results...`)

  // Poll until all tasks complete (max 5 minutes)
  const maxWaitMs = 5 * 60 * 1000
  const startTime = Date.now()
  const pendingTasks = new Set(taskMap.keys())

  while (pendingTasks.size > 0 && Date.now() - startTime < maxWaitMs) {
    await sleep(5000) // Wait 5s between polls

    for (const taskId of [...pendingTasks]) {
      const result = await getReviewTaskResult(config, taskId)

      if (result === 'pending') continue

      pendingTasks.delete(taskId)
      const placeId = taskMap.get(taskId)!

      if (result) {
        results.set(placeId, result.reviews)
        console.log(`[DataForSEO]   ✓ Reviews for ${placeId}: ${result.reviews.length} reviews`)
      } else {
        results.set(placeId, [])
      }

      await sleep(rateLimitMs)
    }

    if (pendingTasks.size > 0) {
      console.log(`[DataForSEO]   Waiting for ${pendingTasks.size} review tasks...`)
    }
  }

  // Mark remaining as empty
  for (const taskId of pendingTasks) {
    results.set(taskMap.get(taskId)!, [])
  }

  return results
}

// ═══════════════════════════════════════════════════════════
// Full Pipeline: search → profile → reviews
// ═══════════════════════════════════════════════════════════

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
  const locationName = `${location.city},${location.stateName},United States`

  // Step 1: Search Google Maps — deduplicate across queries
  const seenPlaceIds = new Set<string>()
  const discoveredListings: Array<{ placeId: string; cid: string | null; title: string; reviewCount: number }> = []

  for (const query of searchQueries) {
    console.log(`[DataForSEO] Searching "${query}" in ${locationName}`)
    const listings = await searchGoogleMaps(config, query, locationName, maxListings)

    for (const listing of listings) {
      if (!seenPlaceIds.has(listing.placeId)) {
        seenPlaceIds.add(listing.placeId)
        discoveredListings.push(listing)
      }
    }

    await sleep(rateLimitMs)
  }

  console.log(`[DataForSEO] Found ${discoveredListings.length} unique attorneys in ${location.city}, ${location.stateCode}`)

  // Step 2: Fetch full business profiles
  const profiles = new Map<string, GoogleBusinessProfile>()
  for (const listing of discoveredListings) {
    console.log(`[DataForSEO]   Profile: ${listing.title}`)
    const profile = await fetchBusinessProfile(config, listing.title, locationName)

    const finalProfile: GoogleBusinessProfile = profile ?? {
      placeId: listing.placeId,
      cid: listing.cid,
      title: listing.title,
      description: null, category: null, categoryIds: [], additionalCategories: [],
      address: null, addressInfo: null, phone: null, website: null, domain: null,
      latitude: null, longitude: null, logoUrl: null, mainImageUrl: null,
      totalPhotos: 0, isClaimed: false, rating: null, reviewCount: listing.reviewCount,
      ratingDistribution: null, workHours: null, attributes: null,
      peopleAlsoSearch: null, googleMapsUrl: null, contactInfo: null,
    }
    profiles.set(listing.placeId, finalProfile)
    await sleep(rateLimitMs)
  }

  // Step 3: Fetch reviews in batch (async task_post → poll task_get)
  const reviewsMap = await fetchReviewsBatch(
    config,
    discoveredListings,
    locationName,
    maxReviewsPerListing
  )

  // Combine profiles + reviews
  const results: AttorneySearchResult[] = []
  for (const listing of discoveredListings) {
    const profile = profiles.get(listing.placeId)!
    const reviews = reviewsMap.get(listing.placeId) ?? []
    results.push({ profile, reviews })
  }

  return results
}

// ═══════════════════════════════════════════════════════════
// State ordering + top cities
// ═══════════════════════════════════════════════════════════

/**
 * Priority state ordering as specified.
 * Remaining states follow alphabetically.
 */
export const STATE_PRIORITY_ORDER = [
  'CO', 'NV', 'WA', 'CA', 'AZ', 'PR', 'UT', 'MI', 'IL', 'TX', 'GA', 'FL', 'NY',
  // Then remaining states alphabetically
  'AL', 'AK', 'AR', 'CT', 'DE', 'HI', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MN', 'MS', 'MO', 'MT', 'NE', 'NH', 'NJ', 'NM', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'VT', 'VA', 'WV',
  'WI', 'WY', 'DC',
]

/** Top cities per state for attorney discovery */
export const TOP_CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Chandler'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville'],
  CA: ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'San Jose', 'Fresno', 'Oakland', 'Riverside', 'Irvine', 'Long Beach'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood'],
  CT: ['Hartford', 'New Haven', 'Bridgeport', 'Stamford'],
  DE: ['Wilmington', 'Dover'],
  FL: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'West Palm Beach', 'St. Petersburg', 'Tallahassee'],
  GA: ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Marietta'],
  HI: ['Honolulu'],
  ID: ['Boise', 'Meridian'],
  IL: ['Chicago', 'Springfield', 'Rockford', 'Naperville', 'Peoria'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport'],
  KS: ['Wichita', 'Kansas City', 'Topeka'],
  KY: ['Louisville', 'Lexington', 'Bowling Green'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport'],
  ME: ['Portland', 'Bangor'],
  MD: ['Baltimore', 'Bethesda', 'Silver Spring', 'Annapolis'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
  MI: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Flint'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester'],
  MS: ['Jackson', 'Gulfport', 'Hattiesburg'],
  MO: ['Kansas City', 'St. Louis', 'Springfield'],
  MT: ['Billings', 'Missoula', 'Great Falls'],
  NE: ['Omaha', 'Lincoln'],
  NV: ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas'],
  NH: ['Manchester', 'Concord', 'Nashua'],
  NJ: ['Newark', 'Jersey City', 'Trenton', 'Cherry Hill', 'Edison'],
  NM: ['Albuquerque', 'Santa Fe', 'Las Cruces'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers'],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem'],
  ND: ['Fargo', 'Bismarck'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Dayton', 'Toledo'],
  OK: ['Oklahoma City', 'Tulsa'],
  OR: ['Portland', 'Eugene', 'Salem'],
  PA: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown'],
  PR: ['San Juan', 'Bayamon', 'Carolina', 'Ponce', 'Caguas'],
  RI: ['Providence', 'Warwick'],
  SC: ['Charleston', 'Columbia', 'Greenville'],
  SD: ['Sioux Falls', 'Rapid City'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  TX: ['Houston', 'Dallas', 'San Antonio', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Plano'],
  UT: ['Salt Lake City', 'Provo', 'Ogden', 'West Jordan'],
  VT: ['Burlington', 'Montpelier'],
  VA: ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Fairfax'],
  WA: ['Seattle', 'Tacoma', 'Spokane', 'Bellevue', 'Vancouver'],
  WV: ['Charleston', 'Huntington'],
  WI: ['Milwaukee', 'Madison', 'Green Bay'],
  WY: ['Cheyenne', 'Casper'],
  DC: ['Washington'],
}
