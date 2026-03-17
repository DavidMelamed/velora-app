/**
 * DataForSEO Google Business Data API Adapter
 *
 * Two endpoints used (all async task_post for cost savings):
 *   1. SERP Google Maps task_post → discover listings + full profiles ($0.0006/task)
 *   2. Google Reviews task_post → all reviews ($0.00075/task)
 *
 * Key optimizations:
 *   - Profile data extracted from SERP Maps (eliminates $0.0015/call business_info)
 *   - Batch up to 100 tasks per POST call
 *   - Use tasks_ready endpoint to poll for completions
 *   - Non-lawyer results filtered before review fetch
 *   - Raw JSON cached to disk so we never pay twice
 *
 * API docs: https://docs.dataforseo.com/v3/business_data/
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

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

/** Max tasks per single POST call (DataForSEO limit) */
const MAX_BATCH_SIZE = 100

/** Default concurrent task_get fetch limit (2,000 req/min capacity) */
const DEFAULT_CONCURRENCY = 10

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

async function apiGet<T>(config: DataForSEOConfig, endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers: { 'Authorization': makeAuthHeader(config) },
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
// Global rate limiter for tasks_ready (20 req/min = 1 per 3s)
// Shared across all concurrent city processors
// ═══════════════════════════════════════════════════════════

const TASKS_READY_MIN_INTERVAL_MS = 3100 // slightly over 3s for safety
let lastTasksReadyCall = 0
const tasksReadyMutex = { locked: false, queue: [] as Array<() => void> }

async function rateLimitedTasksReady<T>(config: DataForSEOConfig, endpoint: string): Promise<T> {
  // Acquire mutex — only one tasks_ready call at a time
  if (tasksReadyMutex.locked) {
    await new Promise<void>(resolve => tasksReadyMutex.queue.push(resolve))
  }
  tasksReadyMutex.locked = true

  try {
    // Enforce minimum interval between calls
    const now = Date.now()
    const elapsed = now - lastTasksReadyCall
    if (elapsed < TASKS_READY_MIN_INTERVAL_MS) {
      await sleep(TASKS_READY_MIN_INTERVAL_MS - elapsed)
    }

    lastTasksReadyCall = Date.now()
    return await apiGet<T>(config, endpoint)
  } finally {
    // Release mutex
    tasksReadyMutex.locked = false
    const next = tasksReadyMutex.queue.shift()
    if (next) next()
  }
}

// ═══════════════════════════════════════════════════════════
// Raw JSON caching — never pay twice for the same data
// ═══════════════════════════════════════════════════════════

const CACHE_DIR = join(process.cwd(), 'data', 'dataforseo-cache')

function getCachePath(type: 'serp-maps' | 'reviews', city: string, stateCode: string): string {
  const dir = join(CACHE_DIR, type)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const safe = `${city}-${stateCode}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return join(dir, `${safe}.json`)
}

function readCache<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch { return null }
}

function writeCache(path: string, data: unknown): void {
  const dir = join(path, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(data), 'utf-8')
}

/**
 * Process items in batches with concurrency control.
 * Runs `batchSize` items concurrently, waits for all to finish, then moves to next batch.
 */
async function processInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

// ═══════════════════════════════════════════════════════════
// Batch task_post helpers
// ═══════════════════════════════════════════════════════════

interface TaskPostResult {
  taskId: string
  tag: string | undefined
}

/**
 * Submit up to 100 tasks in a single POST call.
 * Returns array of { taskId, tag } for successfully queued tasks.
 */
async function batchTaskPost(
  config: DataForSEOConfig,
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskPayloads: Record<string, any>[]
): Promise<TaskPostResult[]> {
  if (taskPayloads.length === 0) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await apiPost<any>(config, endpoint, taskPayloads)

  const results: TaskPostResult[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const task of (data.tasks ?? []) as any[]) {
    if (task.status_code === 20100 && task.id) {
      results.push({ taskId: task.id, tag: task.data?.tag })
    } else {
      console.warn(`[DataForSEO] task_post item failed: ${task?.status_code} ${task?.status_message}`)
    }
  }

  return results
}

/**
 * Submit tasks in chunks of MAX_BATCH_SIZE, returning all task IDs.
 */
async function submitTasksInBatches(
  config: DataForSEOConfig,
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  taskPayloads: Record<string, any>[],
  rateLimitMs: number
): Promise<TaskPostResult[]> {
  const allResults: TaskPostResult[] = []

  for (let i = 0; i < taskPayloads.length; i += MAX_BATCH_SIZE) {
    const chunk = taskPayloads.slice(i, i + MAX_BATCH_SIZE)
    const results = await batchTaskPost(config, endpoint, chunk)
    allResults.push(...results)

    // Rate limit between batch submissions
    if (i + MAX_BATCH_SIZE < taskPayloads.length) {
      await sleep(rateLimitMs)
    }
  }

  return allResults
}

/**
 * Poll the tasks_ready endpoint until all expected tasks are ready,
 * then fetch each result with task_get.
 *
 * @param tasksReadyEndpoint - e.g. '/serp/google/maps/tasks_ready'
 * @param taskGetEndpoint - e.g. '/serp/google/maps/task_get/' (task ID appended)
 * @param taskIds - set of task IDs to wait for
 * @param maxWaitMs - maximum time to wait (default 2min)
 * @returns Map of taskId -> raw task result (or null if failed/timeout)
 */
async function pollAndFetchResults(
  config: DataForSEOConfig,
  tasksReadyEndpoint: string,
  taskGetEndpoint: string,
  taskIds: Set<string>,
  maxWaitMs: number = 2 * 60 * 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Map<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = new Map<string, any>()
  const pending = new Set(taskIds)
  const startTime = Date.now()

  while (pending.size > 0 && Date.now() - startTime < maxWaitMs) {
    try {
      // Use global rate limiter — tasks_ready is limited to 20 req/min
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const readyData = await rateLimitedTasksReady<any>(config, tasksReadyEndpoint)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const readyTasks: any[] = readyData.tasks?.[0]?.result ?? []

      // Filter to only our pending task IDs
      const readyIds = readyTasks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => t.id as string)
        .filter((id: string) => pending.has(id))

      if (readyIds.length > 0) {
        // Fetch results concurrently in batches
        const fetched = await processInBatches(readyIds, DEFAULT_CONCURRENCY, async (taskId: string) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await apiGet<any>(config, `${taskGetEndpoint}${taskId}`)
            const task = data.tasks?.[0]
            return { taskId, task }
          } catch (err) {
            console.warn(`[DataForSEO] task_get failed for ${taskId}:`, err)
            return { taskId, task: null }
          }
        })

        for (const { taskId, task } of fetched) {
          pending.delete(taskId)
          if (task && task.status_code === 20000) {
            results.set(taskId, task)
          } else {
            results.set(taskId, null)
          }
        }
      }
    } catch (err) {
      console.warn(`[DataForSEO] tasks_ready poll error:`, err)
    }

    if (pending.size > 0) {
      console.log(`[DataForSEO]   Waiting for ${pending.size} tasks...`)
    }
  }

  // Mark remaining as null (timed out)
  if (pending.size > 0) {
    console.warn(`[DataForSEO] ⚠ Timed out waiting for ${pending.size} tasks after ${Math.round(maxWaitMs / 1000)}s — moving on`)
  }
  for (const taskId of pending) {
    results.set(taskId, null)
  }

  return results
}

// ═══════════════════════════════════════════════════════════
// Step 1: SERP Google Maps — discover lawyer listings
// Uses /v3/serp/google/maps/task_post (batch of up to 100)
// ═══════════════════════════════════════════════════════════

export async function searchGoogleMaps(
  config: DataForSEOConfig,
  query: string,
  locationName: string,
  depth: number = 20
): Promise<Array<{ placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }>> {
  // Single-query convenience wrapper — posts one task and polls for result
  const results = await searchGoogleMapsBatch(config, [{ query, locationName, depth }])
  return results.get(query) ?? []
}

/**
 * Batch Google Maps search: submit all queries in one API call, poll for results.
 */
export async function searchGoogleMapsBatch(
  config: DataForSEOConfig,
  queries: Array<{ query: string; locationName: string; depth?: number }>
): Promise<Map<string, Array<{ placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }>>> {
  const rateLimitMs = config.rateLimitMs ?? 500

  // Build task payloads — tag each with the query for result mapping
  const taskPayloads = queries.map(q => ({
    keyword: q.query,
    location_name: q.locationName,
    language_code: 'en',
    depth: q.depth ?? 20,
    tag: q.query,
  }))

  // Submit all queries (up to 100 per POST call)
  const posted = await submitTasksInBatches(
    config,
    '/serp/google/maps/task_post',
    taskPayloads,
    rateLimitMs
  )

  console.log(`[DataForSEO] Posted ${posted.length} maps search tasks`)

  if (posted.length === 0) {
    return new Map()
  }

  // Build taskId -> query mapping
  const taskToQuery = new Map<string, string>()
  for (const p of posted) {
    taskToQuery.set(p.taskId, p.tag!)
  }

  // Poll for results
  const rawResults = await pollAndFetchResults(
    config,
    '/serp/google/maps/tasks_ready',
    '/serp/google/maps/task_get/advanced/',
    new Set(posted.map(p => p.taskId))
  )

  // Parse results — extract FULL profile data from SERP (no separate profile API needed)
  const resultMap = new Map<string, Array<{ placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }>>()

  for (const [taskId, task] of rawResults) {
    const query = taskToQuery.get(taskId) ?? ''
    if (!task) {
      resultMap.set(query, [])
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = task.result?.[0]?.items ?? []

    const listings = items
      .filter((item: { type?: string }) => item.type === 'maps_search')
      .filter((item: { place_id?: string }) => item.place_id)
      .map((item: Record<string, unknown>) => ({
        placeId: item.place_id as string,
        cid: (item.cid as string) ?? null,
        title: (item.title as string) ?? 'Unknown',
        reviewCount: (item.rating as { votes_count?: number })?.votes_count ?? 0,
        // Full profile extracted directly from SERP — no $0.0015 profile API call needed!
        profile: mapSerpToProfile(item),
      }))

    resultMap.set(query, listings)
  }

  return resultMap
}

/** Map a SERP Google Maps item directly to a GoogleBusinessProfile.
 *  The SERP response contains all the fields we need — eliminates the
 *  $0.0015/call business_info endpoint entirely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSerpToProfile(item: Record<string, any>): GoogleBusinessProfile {
  return {
    placeId: item.place_id ?? '',
    cid: item.cid ?? null,
    title: item.title ?? 'Unknown',
    description: item.snippet ?? null,
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
    logoUrl: null, // Not in SERP, but rarely needed
    mainImageUrl: item.main_image ?? null,
    totalPhotos: item.total_photos ?? 0,
    isClaimed: item.is_claimed ?? false,
    rating: item.rating?.value ?? null,
    reviewCount: item.rating?.votes_count ?? 0,
    ratingDistribution: item.rating_distribution ?? null,
    workHours: item.work_hours ?? null,
    attributes: null, // Not in SERP
    peopleAlsoSearch: null, // Not in SERP
    googleMapsUrl: null, // Can construct from place_id if needed
    contactInfo: item.contact_url ? [{ type: 'url', value: item.contact_url, source: 'serp' }] : null,
  }
}

/**
 * Coordinate-based Google Maps search: uses lat/lng + zoom for wide-area coverage.
 * Much more efficient than city-by-city: a single zoom=8 query covers ~100mi radius.
 *
 * Cost: $0.0006 per 100 results. depth=400 = $0.0024/task.
 * 3 pins × 5 queries × depth=400 = 15 tasks = $0.036 to cover an entire state
 * vs 20 cities × 23 queries = 460 tasks = $0.276 with city-based approach (7.7x cheaper)
 */
export async function searchGoogleMapsCoordBatch(
  config: DataForSEOConfig,
  queries: Array<{ query: string; coordinate: string; depth?: number; tag?: string }>
): Promise<Map<string, Array<{ placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }>>> {
  const rateLimitMs = config.rateLimitMs ?? 500

  // Build task payloads using location_coordinate instead of location_name
  const taskPayloads = queries.map(q => ({
    keyword: q.query,
    location_coordinate: q.coordinate,
    language_code: 'en',
    depth: q.depth ?? 400,
    search_this_area: true,
    tag: q.tag ?? `${q.query}|${q.coordinate}`,
  }))

  const posted = await submitTasksInBatches(
    config,
    '/serp/google/maps/task_post',
    taskPayloads,
    rateLimitMs
  )

  console.log(`[DataForSEO] Posted ${posted.length} coord-based maps search tasks`)

  if (posted.length === 0) return new Map()

  const taskToTag = new Map<string, string>()
  for (const p of posted) taskToTag.set(p.taskId, p.tag!)

  const rawResults = await pollAndFetchResults(
    config,
    '/serp/google/maps/tasks_ready',
    '/serp/google/maps/task_get/advanced/',
    new Set(posted.map(p => p.taskId))
  )

  const resultMap = new Map<string, Array<{ placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }>>()

  for (const [taskId, task] of rawResults) {
    const tag = taskToTag.get(taskId) ?? ''
    if (!task) { resultMap.set(tag, []); continue }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = task.result?.[0]?.items ?? []
    const listings = items
      .filter((item: { type?: string }) => item.type === 'maps_search')
      .filter((item: { place_id?: string }) => item.place_id)
      .map((item: Record<string, unknown>) => ({
        placeId: item.place_id as string,
        cid: (item.cid as string) ?? null,
        title: (item.title as string) ?? 'Unknown',
        reviewCount: (item.rating as { votes_count?: number })?.votes_count ?? 0,
        profile: mapSerpToProfile(item),
      }))

    resultMap.set(tag, listings)
  }

  return resultMap
}

/**
 * Discover attorneys across an entire state using coordinate pins.
 * Uses 3-5 lat/lng points with low zoom (wide area) instead of per-city queries.
 * ~8x cheaper than city-based approach for SERP discovery.
 */
export async function discoverAttorneysByRegion(
  config: DataForSEOConfig,
  stateCode: string,
  stateName: string,
  options: {
    maxReviewsPerListing?: number
    skipPlaceIds?: Set<string>
    searchQueries?: string[]
    serpDepth?: number
  } = {}
): Promise<AttorneySearchResult[]> {
  const {
    maxReviewsPerListing = 20,
    searchQueries = REGION_SEARCH_QUERIES,
    serpDepth = 400,
  } = options

  const pins = STATE_COORDINATE_PINS[stateCode]
  if (!pins || pins.length === 0) {
    console.warn(`[DataForSEO] No coordinate pins for ${stateCode}, skipping`)
    return []
  }

  // ─── Check SERP cache ───
  const serpCachePath = getCachePath('serp-maps', `region-${stateCode}`, stateCode)
  type SerpCacheEntry = { placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }
  let discoveredListings: SerpCacheEntry[]

  const cached = readCache<SerpCacheEntry[]>(serpCachePath)
  if (cached) {
    console.log(`[DataForSEO] CACHE HIT: ${cached.length} listings for ${stateCode} region`)
    discoveredListings = cached
  } else {
    // Build queries: each pin × each search query
    const coordQueries: Array<{ query: string; coordinate: string; depth: number; tag: string }> = []
    for (const pin of pins) {
      const coord = `${pin.lat},${pin.lng},${pin.zoom}z`
      for (const query of searchQueries) {
        coordQueries.push({ query, coordinate: coord, depth: serpDepth, tag: `${query}|${coord}` })
      }
    }

    console.log(`[DataForSEO] ${stateCode}: ${pins.length} pins × ${searchQueries.length} queries = ${coordQueries.length} tasks (depth=${serpDepth})`)
    const estCost = coordQueries.length * (serpDepth / 100) * 0.0006
    console.log(`[DataForSEO] Estimated SERP cost: $${estCost.toFixed(4)}`)

    const mapResults = await searchGoogleMapsCoordBatch(config, coordQueries)

    // Deduplicate across all pins + queries
    const seenPlaceIds = new Set<string>()
    discoveredListings = []

    for (const [, listings] of mapResults) {
      for (const listing of listings) {
        if (!seenPlaceIds.has(listing.placeId)) {
          seenPlaceIds.add(listing.placeId)
          discoveredListings.push(listing)
        }
      }
    }

    writeCache(serpCachePath, discoveredListings)
    console.log(`[DataForSEO] ${stateCode}: Found ${discoveredListings.length} unique listings, cached`)
  }

  // ─── Filter non-lawyers ───
  const lawyerListings = discoveredListings.filter(l => isLikelyLawyer(l.profile))
  const filtered = discoveredListings.length - lawyerListings.length
  if (filtered > 0) console.log(`[DataForSEO] Filtered ${filtered} non-lawyer results`)
  console.log(`[DataForSEO] ${stateCode}: ${lawyerListings.length} lawyers total`)

  // ─── Skip already-ingested ───
  const newListings = options.skipPlaceIds
    ? lawyerListings.filter(l => !options.skipPlaceIds!.has(l.placeId))
    : lawyerListings

  if (newListings.length < lawyerListings.length) {
    console.log(`[DataForSEO] Skipping ${lawyerListings.length - newListings.length} already-ingested`)
  }

  if (newListings.length === 0) {
    console.log(`[DataForSEO] All lawyers already ingested for ${stateCode}`)
    return []
  }

  // ─── Fetch reviews (check cache) ───
  const reviewsCachePath = getCachePath('reviews', `region-${stateCode}`, stateCode)
  type ReviewCacheEntry = { placeId: string; reviews: GoogleReviewFull[] }
  let reviewsData: ReviewCacheEntry[]

  const cachedReviews = readCache<ReviewCacheEntry[]>(reviewsCachePath)
  if (cachedReviews) {
    console.log(`[DataForSEO] CACHE HIT: reviews for ${stateCode} region`)
    reviewsData = cachedReviews
  } else {
    console.log(`[DataForSEO] Submitting review tasks for ${newListings.length} lawyers in ${stateCode}`)

    // Use place_id directly for reviews (more reliable than keyword)
    const locationName = `${stateName},United States`
    const reviewsMap = await fetchReviewsBatch(config, newListings, locationName, maxReviewsPerListing)

    reviewsData = []
    for (const [placeId, reviews] of reviewsMap) {
      reviewsData.push({ placeId, reviews })
    }
    writeCache(reviewsCachePath, reviewsData)
    console.log(`[DataForSEO] Cached reviews for ${reviewsData.length} attorneys in ${stateCode}`)
  }

  // Build reviews lookup
  const reviewsMap = new Map<string, GoogleReviewFull[]>()
  for (const entry of reviewsData) reviewsMap.set(entry.placeId, entry.reviews)

  // Combine profiles + reviews
  const results: AttorneySearchResult[] = []
  for (const listing of newListings) {
    const reviews = reviewsMap.get(listing.placeId) ?? []
    results.push({ profile: listing.profile, reviews })
  }

  return results
}

/**
 * Reduced query set for region-based search.
 * With wide zoom, broad queries capture more; niche queries still help find specialists.
 */
export const REGION_SEARCH_QUERIES = [
  'personal injury lawyer',
  'car accident attorney',
  'medical malpractice lawyer',
  'wrongful death attorney',
  'workers compensation lawyer',
  'truck accident lawyer',
  'slip and fall attorney',
  'motorcycle accident attorney',
  'abogado de accidentes',
]

/**
 * Strategic coordinate pins per state.
 * Each pin with zoom=8 covers ~100mi radius. 3-5 pins covers an entire state.
 * This replaces the 570-city list with ~150 total pins nationwide.
 */
export const STATE_COORDINATE_PINS: Record<string, Array<{ lat: number; lng: number; zoom: number; label: string }>> = {
  // Already have good coverage — these are for remaining states
  PA: [
    { lat: 39.9526, lng: -75.1652, zoom: 9, label: 'Philadelphia' },
    { lat: 40.4406, lng: -79.9959, zoom: 9, label: 'Pittsburgh' },
    { lat: 40.2732, lng: -76.8867, zoom: 9, label: 'Central PA' },
    { lat: 41.4090, lng: -75.6624, zoom: 9, label: 'Scranton/NE PA' },
  ],
  TN: [
    { lat: 36.1627, lng: -86.7816, zoom: 9, label: 'Nashville' },
    { lat: 35.1495, lng: -90.0490, zoom: 9, label: 'Memphis' },
    { lat: 35.9606, lng: -83.9207, zoom: 9, label: 'Knoxville' },
    { lat: 35.0456, lng: -85.3097, zoom: 9, label: 'Chattanooga' },
  ],
  MD: [
    { lat: 39.2904, lng: -76.6122, zoom: 9, label: 'Baltimore' },
    { lat: 38.9072, lng: -77.0369, zoom: 9, label: 'DC suburbs' },
    { lat: 39.6418, lng: -77.7200, zoom: 9, label: 'Western MD' },
  ],
  MA: [
    { lat: 42.3601, lng: -71.0589, zoom: 9, label: 'Boston' },
    { lat: 42.1015, lng: -72.5898, zoom: 9, label: 'Springfield' },
    { lat: 42.2626, lng: -71.8023, zoom: 9, label: 'Worcester' },
  ],
  NJ: [
    { lat: 40.7357, lng: -74.1724, zoom: 9, label: 'Newark/N Jersey' },
    { lat: 39.9526, lng: -74.9780, zoom: 9, label: 'S Jersey/Cherry Hill' },
    { lat: 40.2206, lng: -74.7699, zoom: 9, label: 'Central NJ/Trenton' },
  ],
  OH: [
    { lat: 39.9612, lng: -82.9988, zoom: 9, label: 'Columbus' },
    { lat: 41.4993, lng: -81.6944, zoom: 9, label: 'Cleveland' },
    { lat: 39.1031, lng: -84.5120, zoom: 9, label: 'Cincinnati' },
    { lat: 39.7589, lng: -84.1916, zoom: 9, label: 'Dayton' },
    { lat: 41.0814, lng: -81.5190, zoom: 9, label: 'Akron' },
  ],
  NC: [
    { lat: 35.2271, lng: -80.8431, zoom: 9, label: 'Charlotte' },
    { lat: 35.7796, lng: -78.6382, zoom: 9, label: 'Raleigh' },
    { lat: 36.0726, lng: -79.7920, zoom: 9, label: 'Greensboro' },
    { lat: 35.5951, lng: -82.5515, zoom: 9, label: 'Asheville' },
  ],
  VA: [
    { lat: 36.8529, lng: -75.9780, zoom: 9, label: 'Virginia Beach/Norfolk' },
    { lat: 37.5407, lng: -77.4360, zoom: 9, label: 'Richmond' },
    { lat: 38.8816, lng: -77.0910, zoom: 9, label: 'NoVA/Arlington' },
    { lat: 37.2710, lng: -79.9414, zoom: 9, label: 'Roanoke' },
  ],
  MO: [
    { lat: 38.6270, lng: -90.1994, zoom: 9, label: 'St. Louis' },
    { lat: 39.0997, lng: -94.5786, zoom: 9, label: 'Kansas City' },
    { lat: 37.2090, lng: -93.2923, zoom: 9, label: 'Springfield' },
  ],
  IN: [
    { lat: 39.7684, lng: -86.1581, zoom: 9, label: 'Indianapolis' },
    { lat: 41.0793, lng: -85.1394, zoom: 9, label: 'Fort Wayne' },
    { lat: 41.6764, lng: -86.2520, zoom: 9, label: 'South Bend' },
    { lat: 37.9716, lng: -87.5711, zoom: 9, label: 'Evansville' },
  ],
  WI: [
    { lat: 43.0389, lng: -87.9065, zoom: 9, label: 'Milwaukee' },
    { lat: 43.0731, lng: -89.4012, zoom: 9, label: 'Madison' },
    { lat: 44.5192, lng: -88.0198, zoom: 9, label: 'Green Bay' },
  ],
  MN: [
    { lat: 44.9778, lng: -93.2650, zoom: 9, label: 'Minneapolis/St Paul' },
    { lat: 44.0121, lng: -92.4802, zoom: 9, label: 'Rochester' },
    { lat: 46.7867, lng: -92.1005, zoom: 9, label: 'Duluth' },
  ],
  SC: [
    { lat: 32.7765, lng: -79.9311, zoom: 9, label: 'Charleston' },
    { lat: 34.0007, lng: -81.0348, zoom: 9, label: 'Columbia' },
    { lat: 34.8526, lng: -82.3940, zoom: 9, label: 'Greenville' },
  ],
  LA: [
    { lat: 29.9511, lng: -90.0715, zoom: 9, label: 'New Orleans' },
    { lat: 30.4515, lng: -91.1871, zoom: 9, label: 'Baton Rouge' },
    { lat: 32.5252, lng: -93.7502, zoom: 9, label: 'Shreveport' },
  ],
  KY: [
    { lat: 38.2527, lng: -85.7585, zoom: 9, label: 'Louisville' },
    { lat: 38.0406, lng: -84.5037, zoom: 9, label: 'Lexington' },
    { lat: 39.0837, lng: -84.5106, zoom: 9, label: 'N KY/Covington' },
  ],
  OR: [
    { lat: 45.5152, lng: -122.6784, zoom: 9, label: 'Portland' },
    { lat: 44.0521, lng: -123.0868, zoom: 9, label: 'Eugene' },
    { lat: 44.9429, lng: -123.0351, zoom: 9, label: 'Salem' },
  ],
  OK: [
    { lat: 35.4676, lng: -97.5164, zoom: 9, label: 'Oklahoma City' },
    { lat: 36.1540, lng: -95.9928, zoom: 9, label: 'Tulsa' },
  ],
  KS: [
    { lat: 37.6872, lng: -97.3301, zoom: 9, label: 'Wichita' },
    { lat: 39.0473, lng: -95.6752, zoom: 9, label: 'Topeka' },
    { lat: 38.9717, lng: -94.6086, zoom: 9, label: 'KC suburbs' },
  ],
  IA: [
    { lat: 41.5868, lng: -93.6250, zoom: 9, label: 'Des Moines' },
    { lat: 41.9779, lng: -91.6656, zoom: 9, label: 'Cedar Rapids' },
    { lat: 41.5236, lng: -90.5776, zoom: 9, label: 'Davenport' },
  ],
  MS: [
    { lat: 32.2988, lng: -90.1848, zoom: 9, label: 'Jackson' },
    { lat: 30.3674, lng: -89.0928, zoom: 9, label: 'Gulfport/Biloxi' },
  ],
  NE: [
    { lat: 41.2565, lng: -95.9345, zoom: 9, label: 'Omaha' },
    { lat: 40.8136, lng: -96.7026, zoom: 9, label: 'Lincoln' },
  ],
  WV: [
    { lat: 38.3498, lng: -81.6326, zoom: 9, label: 'Charleston' },
    { lat: 38.4192, lng: -82.4452, zoom: 9, label: 'Huntington' },
  ],
  NH: [
    { lat: 42.9956, lng: -71.4548, zoom: 9, label: 'Manchester/Nashua' },
    { lat: 43.2081, lng: -71.5376, zoom: 9, label: 'Concord' },
  ],
  ME: [
    { lat: 43.6591, lng: -70.2568, zoom: 9, label: 'Portland' },
    { lat: 44.8016, lng: -68.7712, zoom: 9, label: 'Bangor' },
  ],
  HI: [
    { lat: 21.3069, lng: -157.8583, zoom: 10, label: 'Honolulu' },
  ],
  ID: [
    { lat: 43.6150, lng: -116.2023, zoom: 9, label: 'Boise' },
    { lat: 43.4927, lng: -112.0408, zoom: 9, label: 'Idaho Falls' },
    { lat: 47.6777, lng: -116.7805, zoom: 9, label: 'Coeur d\'Alene' },
  ],
  MT: [
    { lat: 45.7833, lng: -108.5007, zoom: 8, label: 'Billings' },
    { lat: 46.8721, lng: -113.9940, zoom: 8, label: 'Missoula' },
    { lat: 47.5062, lng: -111.2813, zoom: 8, label: 'Great Falls' },
  ],
  SD: [
    { lat: 43.5460, lng: -96.7313, zoom: 8, label: 'Sioux Falls' },
    { lat: 44.0805, lng: -103.2310, zoom: 8, label: 'Rapid City' },
  ],
  ND: [
    { lat: 46.8772, lng: -96.7898, zoom: 8, label: 'Fargo' },
    { lat: 46.8083, lng: -100.7837, zoom: 8, label: 'Bismarck' },
  ],
  VT: [
    { lat: 44.4759, lng: -73.2121, zoom: 9, label: 'Burlington' },
    { lat: 43.6106, lng: -72.9726, zoom: 9, label: 'Rutland' },
  ],
  RI: [
    { lat: 41.8240, lng: -71.4128, zoom: 10, label: 'Providence' },
  ],
  DE: [
    { lat: 39.7391, lng: -75.5398, zoom: 10, label: 'Wilmington' },
    { lat: 39.1582, lng: -75.5244, zoom: 10, label: 'Dover' },
  ],
  DC: [
    { lat: 38.9072, lng: -77.0369, zoom: 11, label: 'Washington DC' },
  ],
  PR: [
    { lat: 18.4655, lng: -66.1057, zoom: 9, label: 'San Juan' },
    { lat: 18.0111, lng: -66.6141, zoom: 9, label: 'Ponce' },
    { lat: 18.2013, lng: -67.1397, zoom: 9, label: 'Mayaguez' },
  ],
}

// ═══════════════════════════════════════════════════════════
// Step 2: Google My Business Info — full profile
// Uses /v3/business_data/google/my_business_info/task_post
// ═══════════════════════════════════════════════════════════

export async function fetchBusinessProfile(
  config: DataForSEOConfig,
  keyword: string,
  locationName: string
): Promise<GoogleBusinessProfile | null> {
  // Single-profile convenience wrapper
  const results = await fetchBusinessProfilesBatch(config, [{ keyword, locationName }])
  return results.get(keyword) ?? null
}

/**
 * Batch business profile fetch: submit all in batches of 100, poll for results.
 */
export async function fetchBusinessProfilesBatch(
  config: DataForSEOConfig,
  queries: Array<{ keyword: string; locationName: string }>
): Promise<Map<string, GoogleBusinessProfile | null>> {
  const rateLimitMs = config.rateLimitMs ?? 500

  const taskPayloads = queries.map(q => ({
    keyword: q.keyword,
    location_name: q.locationName,
    language_code: 'en',
    tag: q.keyword,
  }))

  const posted = await submitTasksInBatches(
    config,
    '/business_data/google/my_business_info/task_post',
    taskPayloads,
    rateLimitMs
  )

  console.log(`[DataForSEO] Posted ${posted.length} business profile tasks`)

  if (posted.length === 0) {
    return new Map()
  }

  const taskToKeyword = new Map<string, string>()
  for (const p of posted) {
    taskToKeyword.set(p.taskId, p.tag!)
  }

  const rawResults = await pollAndFetchResults(
    config,
    '/business_data/google/my_business_info/tasks_ready',
    '/business_data/google/my_business_info/task_get/',
    new Set(posted.map(p => p.taskId))
  )

  const resultMap = new Map<string, GoogleBusinessProfile | null>()

  for (const [taskId, task] of rawResults) {
    const keyword = taskToKeyword.get(taskId) ?? ''
    if (!task || !task.result?.[0]?.items?.[0]) {
      resultMap.set(keyword, null)
      continue
    }

    resultMap.set(keyword, mapToProfile(task.result[0].items[0]))
  }

  return resultMap
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

  return {
    reviews: mapReviewItems(result.items ?? []),
    title: result.title ?? '',
    placeId: result.place_id ?? '',
    rating: result.rating?.value ?? 0,
    reviewCount: result.reviews_count ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReviewItems(items: any[]): GoogleReviewFull[] {
  return items.map((item: Record<string, unknown>) => ({
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

  // Build task payloads, skip listings with 0 reviews
  const taskPayloads: Array<{ keyword: string; location_name: string; language_code: string; depth: number; sort_by: string; tag: string }> = []
  const tagToPlaceId = new Map<string, string>()

  for (const listing of listings) {
    if (listing.reviewCount === 0) {
      results.set(listing.placeId, [])
      continue
    }

    const keyword = `${listing.title} ${locationName.split(',')[0]}`
    const tag = listing.placeId
    taskPayloads.push({
      keyword,
      location_name: locationName,
      language_code: 'en',
      depth,
      sort_by: 'newest',
      tag,
    })
    tagToPlaceId.set(tag, listing.placeId)
  }

  if (taskPayloads.length === 0) return results

  // Submit in batches of 100
  const posted = await submitTasksInBatches(
    config,
    '/business_data/google/reviews/task_post',
    taskPayloads,
    rateLimitMs
  )

  console.log(`[DataForSEO] Posted ${posted.length} review tasks, waiting for results...`)

  if (posted.length === 0) return results

  // Build taskId -> placeId mapping
  const taskToPlaceId = new Map<string, string>()
  for (const p of posted) {
    const placeId = tagToPlaceId.get(p.tag!) ?? p.tag!
    taskToPlaceId.set(p.taskId, placeId)
  }

  // Poll using tasks_ready endpoint
  const rawResults = await pollAndFetchResults(
    config,
    '/business_data/google/reviews/tasks_ready',
    '/business_data/google/reviews/task_get/',
    new Set(posted.map(p => p.taskId))
  )

  for (const [taskId, task] of rawResults) {
    const placeId = taskToPlaceId.get(taskId)!
    if (!task || !task.result?.[0]) {
      results.set(placeId, [])
      continue
    }

    const reviews = mapReviewItems(task.result[0].items ?? [])
    results.set(placeId, reviews)
    console.log(`[DataForSEO]   Reviews for ${placeId}: ${reviews.length} reviews`)
  }

  return results
}

// ═══════════════════════════════════════════════════════════
// Full Pipeline: search → profile → reviews
// All steps use batch task_post + concurrent execution
// ═══════════════════════════════════════════════════════════

export async function discoverAttorneysWithReviews(
  config: DataForSEOConfig,
  location: { city: string; stateCode: string; stateName: string },
  options: {
    searchQueries?: string[]
    maxListings?: number
    maxReviewsPerListing?: number
    skipPlaceIds?: Set<string>
  } = {}
): Promise<AttorneySearchResult[]> {
  const {
    searchQueries = SEARCH_QUERIES,
    maxListings = 100,
    maxReviewsPerListing = 100,
  } = options

  const locationName = `${location.city},${location.stateName},United States`

  // ─── Check SERP cache first ───
  const serpCachePath = getCachePath('serp-maps', location.city, location.stateCode)
  type SerpCacheEntry = { placeId: string; cid: string | null; title: string; reviewCount: number; profile: GoogleBusinessProfile }
  let discoveredListings: SerpCacheEntry[]

  const cached = readCache<SerpCacheEntry[]>(serpCachePath)
  if (cached) {
    console.log(`[DataForSEO] CACHE HIT: ${cached.length} listings from ${serpCachePath}`)
    discoveredListings = cached
  } else {
    // ─── Step 1: Batch POST all map search queries in one call ───
    console.log(`[DataForSEO] Submitting ${searchQueries.length} map search queries for ${locationName}`)

    const mapResults = await searchGoogleMapsBatch(
      config,
      searchQueries.map(query => ({ query, locationName, depth: maxListings }))
    )

    // Deduplicate across all queries — profiles already extracted from SERP (free!)
    const seenPlaceIds = new Set<string>()
    discoveredListings = []

    for (const query of searchQueries) {
      const listings = mapResults.get(query) ?? []
      for (const listing of listings) {
        if (!seenPlaceIds.has(listing.placeId)) {
          seenPlaceIds.add(listing.placeId)
          discoveredListings.push(listing)
        }
      }
    }

    // Cache raw SERP results to disk
    writeCache(serpCachePath, discoveredListings)
    console.log(`[DataForSEO] Cached ${discoveredListings.length} listings to ${serpCachePath}`)
  }

  // ─── Filter non-lawyers to avoid wasting review API costs ───
  const lawyerListings = discoveredListings.filter(l => isLikelyLawyer(l.profile))
  const filtered = discoveredListings.length - lawyerListings.length
  if (filtered > 0) {
    console.log(`[DataForSEO] Filtered ${filtered} non-lawyer results`)
  }

  console.log(`[DataForSEO] Found ${lawyerListings.length} lawyers in ${location.city}, ${location.stateCode}`)

  // ─── Skip already-ingested attorneys ───
  const newListings = options.skipPlaceIds
    ? lawyerListings.filter(l => !options.skipPlaceIds!.has(l.placeId))
    : lawyerListings

  if (newListings.length < lawyerListings.length) {
    console.log(`[DataForSEO] Skipping ${lawyerListings.length - newListings.length} already-ingested`)
  }

  if (newListings.length === 0) {
    console.log(`[DataForSEO] All lawyers already ingested for ${location.city}, ${location.stateCode}`)
    return []
  }

  // ─── Step 2: SKIPPED — profiles already extracted from SERP Maps (saves $0.0015/attorney) ───

  // ─── Step 3: Fetch reviews (check cache first) ───
  const reviewsCachePath = getCachePath('reviews', location.city, location.stateCode)
  type ReviewCacheEntry = { placeId: string; reviews: GoogleReviewFull[] }
  let reviewsData: ReviewCacheEntry[]

  const cachedReviews = readCache<ReviewCacheEntry[]>(reviewsCachePath)
  if (cachedReviews) {
    console.log(`[DataForSEO] CACHE HIT: reviews from ${reviewsCachePath}`)
    reviewsData = cachedReviews
  } else {
    console.log(`[DataForSEO] Submitting review tasks for ${newListings.length} lawyers`)

    const reviewsMap = await fetchReviewsBatch(
      config,
      newListings,
      locationName,
      maxReviewsPerListing
    )

    // Cache raw reviews
    reviewsData = []
    for (const [placeId, reviews] of reviewsMap) {
      reviewsData.push({ placeId, reviews })
    }
    writeCache(reviewsCachePath, reviewsData)
    console.log(`[DataForSEO] Cached reviews for ${reviewsData.length} attorneys`)
  }

  // Build reviews lookup
  const reviewsMap = new Map<string, GoogleReviewFull[]>()
  for (const entry of reviewsData) {
    reviewsMap.set(entry.placeId, entry.reviews)
  }

  // ─── Combine profiles + reviews ───
  const results: AttorneySearchResult[] = []
  for (const listing of newListings) {
    const reviews = reviewsMap.get(listing.placeId) ?? []
    results.push({ profile: listing.profile, reviews })
  }

  return results
}

/** Category-based filter to exclude non-lawyer results (chiropractors, hospitals, etc.) */
function isLikelyLawyer(profile: GoogleBusinessProfile): boolean {
  const category = (profile.category ?? '').toLowerCase()
  const categoryIds = profile.categoryIds.map(c => c.toLowerCase())
  const title = profile.title.toLowerCase()

  // Positive signals — any of these means it's a lawyer
  const lawyerCategories = [
    'lawyer', 'attorney', 'law_firm', 'law firm', 'legal',
    'personal_injury', 'personal injury',
    'trial_attorney', 'trial attorney',
    'medical_lawyer', 'insurance_attorney',
    'abogado',
  ]
  for (const kw of lawyerCategories) {
    if (category.includes(kw)) return true
    if (categoryIds.some(c => c.includes(kw))) return true
  }

  // Title-based fallback
  const lawyerTitleWords = ['lawyer', 'attorney', 'law firm', 'law office', 'law group', 'legal', 'abogado']
  for (const kw of lawyerTitleWords) {
    if (title.includes(kw)) return true
  }

  return false
}

// ═══════════════════════════════════════════════════════════
// State ordering + top cities
// ═══════════════════════════════════════════════════════════

/**
 * Search queries designed for MAXIMUM COVERAGE — each surfaces different firms.
 * Avoids synonyms that return the same results (e.g., "lawyer" vs "attorney").
 * Instead, each query targets a different practice area or firm type.
 */
export const SEARCH_QUERIES = [
  // Broad discovery — the main net
  'personal injury lawyer',
  'accident attorney',
  // Practice area niches — each surfaces specialists that don't rank for generic terms
  'car accident lawyer',
  'truck accident attorney',
  'motorcycle accident lawyer',
  'medical malpractice attorney',
  'wrongful death lawyer',
  'slip and fall attorney',
  'workers compensation lawyer',
  'dog bite attorney',
  'product liability lawyer',
  'brain injury lawyer',
  'spinal cord injury attorney',
  'construction accident lawyer',
  'pedestrian accident attorney',
  'bicycle accident lawyer',
  'uber lyft accident attorney',
  'nursing home abuse lawyer',
  'birth injury attorney',
  'premises liability lawyer',
  'catastrophic injury attorney',
  // Spanish-language firms (large untapped segment)
  'abogado de accidentes',
  'abogado de lesiones personales',
]

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

/** Top cities + suburbs per state for maximum attorney coverage */
export const TOP_CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa', 'Hoover', 'Dothan', 'Decatur'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau', 'Wasilla'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Chandler', 'Glendale', 'Tempe', 'Peoria', 'Gilbert', 'Surprise', 'Goodyear', 'Flagstaff', 'Yuma'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Jonesboro', 'North Little Rock', 'Rogers', 'Springdale'],
  CA: [
    // LA metro
    'Los Angeles', 'Pasadena', 'Glendale', 'Burbank', 'Santa Monica', 'Torrance', 'Downey', 'Pomona', 'West Covina', 'Inglewood', 'Whittier', 'Alhambra', 'El Monte',
    // Orange County
    'Irvine', 'Anaheim', 'Santa Ana', 'Huntington Beach', 'Garden Grove', 'Orange', 'Fullerton', 'Costa Mesa', 'Mission Viejo', 'Newport Beach',
    // SF Bay Area
    'San Francisco', 'Oakland', 'San Jose', 'Fremont', 'Hayward', 'Sunnyvale', 'Santa Clara', 'Concord', 'Berkeley', 'Walnut Creek', 'Palo Alto', 'Redwood City',
    // San Diego metro
    'San Diego', 'Chula Vista', 'Oceanside', 'Escondido', 'Carlsbad', 'El Cajon',
    // Inland Empire
    'Riverside', 'San Bernardino', 'Ontario', 'Rancho Cucamonga', 'Fontana', 'Moreno Valley', 'Corona', 'Temecula', 'Murrieta',
    // Central Valley
    'Sacramento', 'Fresno', 'Bakersfield', 'Stockton', 'Modesto', 'Visalia', 'Elk Grove', 'Roseville',
    // Other
    'Long Beach', 'Santa Barbara', 'Ventura', 'Oxnard', 'Thousand Oaks', 'Palmdale', 'Lancaster', 'Victorville',
  ],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder', 'Lakewood', 'Thornton', 'Westminster', 'Arvada', 'Centennial', 'Pueblo', 'Greeley', 'Broomfield', 'Longmont', 'Castle Rock'],
  CT: ['Hartford', 'New Haven', 'Bridgeport', 'Stamford', 'Waterbury', 'Norwalk', 'Danbury', 'New Britain', 'Bristol', 'Meriden'],
  DE: ['Wilmington', 'Dover', 'Newark', 'Middletown'],
  FL: [
    'Miami', 'Fort Lauderdale', 'West Palm Beach', 'Boca Raton', 'Hollywood', 'Pompano Beach', 'Hialeah', 'Miami Beach', 'Coral Gables', 'Doral', 'Homestead',
    'Tampa', 'St. Petersburg', 'Clearwater', 'Brandon', 'Lakeland',
    'Orlando', 'Kissimmee', 'Sanford', 'Daytona Beach', 'Ocala',
    'Jacksonville', 'St. Augustine',
    'Sarasota', 'Bradenton', 'Naples', 'Fort Myers', 'Cape Coral',
    'Tallahassee', 'Gainesville', 'Pensacola', 'Panama City',
  ],
  GA: ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Marietta', 'Macon', 'Roswell', 'Sandy Springs', 'Johns Creek', 'Alpharetta', 'Lawrenceville', 'Decatur', 'Smyrna', 'Duluth', 'Athens'],
  HI: ['Honolulu', 'Hilo', 'Kailua'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello', 'Coeur d\'Alene', 'Twin Falls'],
  IL: ['Chicago', 'Springfield', 'Rockford', 'Naperville', 'Peoria', 'Joliet', 'Aurora', 'Elgin', 'Champaign', 'Schaumburg', 'Evanston', 'Skokie', 'Cicero', 'Oak Brook', 'Wheaton', 'Waukegan', 'Bloomington', 'Decatur'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers', 'Bloomington', 'Hammond', 'Gary', 'Muncie', 'Lafayette'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Waterloo', 'Council Bluffs'],
  KS: ['Wichita', 'Kansas City', 'Topeka', 'Olathe', 'Overland Park', 'Lawrence', 'Shawnee'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington', 'Florence', 'Frankfort'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Metairie', 'Lafayette', 'Lake Charles', 'Kenner', 'Monroe', 'Alexandria'],
  ME: ['Portland', 'Bangor', 'Lewiston', 'Auburn'],
  MD: ['Baltimore', 'Bethesda', 'Silver Spring', 'Annapolis', 'Rockville', 'Frederick', 'Gaithersburg', 'Columbia', 'Towson', 'Bowie', 'Waldorf'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'Quincy', 'New Bedford', 'Fall River', 'Newton', 'Framingham', 'Brookline'],
  MI: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Sterling Heights', 'Warren', 'Troy', 'Southfield', 'Livonia', 'Kalamazoo', 'Saginaw'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington', 'Brooklyn Park', 'Plymouth', 'Woodbury', 'Maple Grove', 'Eden Prairie'],
  MS: ['Jackson', 'Gulfport', 'Hattiesburg', 'Biloxi', 'Southaven', 'Tupelo', 'Meridian'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Charles', 'St. Joseph'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Helena'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
  NV: ['Las Vegas', 'Reno', 'Henderson', 'North Las Vegas', 'Sparks', 'Carson City', 'Summerlin'],
  NH: ['Manchester', 'Concord', 'Nashua', 'Dover', 'Portsmouth'],
  NJ: ['Newark', 'Jersey City', 'Trenton', 'Cherry Hill', 'Edison', 'Paterson', 'Elizabeth', 'Clifton', 'Toms River', 'Morristown', 'Hackensack', 'New Brunswick', 'Camden', 'Woodbridge', 'Parsippany', 'Wayne', 'Atlantic City'],
  NM: ['Albuquerque', 'Santa Fe', 'Las Cruces', 'Rio Rancho', 'Roswell'],
  NY: [
    'New York', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island',
    'Buffalo', 'Rochester', 'Albany', 'Syracuse', 'Yonkers',
    'White Plains', 'New Rochelle', 'Hempstead', 'Garden City',
    'Long Island', 'Poughkeepsie', 'Utica', 'Binghamton', 'Schenectady',
  ],
  NC: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord', 'Gastonia', 'Asheville', 'Huntersville'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Dayton', 'Toledo', 'Akron', 'Canton', 'Youngstown', 'Parma', 'Lakewood', 'Lorain', 'Elyria', 'Mentor', 'Dublin', 'Westerville'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton', 'Moore'],
  OR: ['Portland', 'Eugene', 'Salem', 'Bend', 'Medford', 'Beaverton', 'Hillsboro', 'Gresham', 'Lake Oswego'],
  PA: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Erie', 'King of Prussia', 'Norristown', 'Media', 'West Chester', 'Bucks County'],
  PR: ['San Juan', 'Bayamon', 'Carolina', 'Ponce', 'Caguas', 'Guaynabo', 'Mayaguez', 'Arecibo'],
  RI: ['Providence', 'Warwick', 'Cranston', 'Pawtucket'],
  SC: ['Charleston', 'Columbia', 'Greenville', 'Myrtle Beach', 'Rock Hill', 'Mount Pleasant', 'North Charleston', 'Spartanburg', 'Summerville'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro', 'Franklin', 'Jackson', 'Johnson City'],
  TX: [
    'Houston', 'Pasadena', 'Sugar Land', 'The Woodlands', 'Katy', 'Pearland', 'League City', 'Baytown',
    'Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Irving', 'Garland', 'Grand Prairie', 'McKinney', 'Frisco', 'Denton', 'Mesquite', 'Richardson', 'Carrollton', 'Lewisville',
    'San Antonio', 'New Braunfels',
    'Austin', 'Round Rock', 'Cedar Park', 'Georgetown',
    'El Paso', 'Laredo', 'McAllen', 'Brownsville', 'Harlingen',
    'Corpus Christi', 'Lubbock', 'Amarillo', 'Waco', 'Tyler', 'Beaumont', 'Odessa', 'Midland', 'Abilene', 'San Marcos', 'Temple', 'Killeen',
  ],
  UT: ['Salt Lake City', 'Provo', 'Ogden', 'West Jordan', 'West Valley City', 'Sandy', 'Orem', 'Layton', 'South Jordan', 'Lehi', 'St. George', 'Logan'],
  VT: ['Burlington', 'Montpelier', 'Rutland'],
  VA: ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington', 'Fairfax', 'Alexandria', 'Newport News', 'Hampton', 'Chesapeake', 'Roanoke', 'Lynchburg', 'Charlottesville', 'Manassas', 'Woodbridge', 'McLean', 'Tysons'],
  WA: ['Seattle', 'Tacoma', 'Spokane', 'Bellevue', 'Vancouver', 'Kent', 'Everett', 'Renton', 'Federal Way', 'Kirkland', 'Auburn', 'Redmond', 'Olympia', 'Yakima', 'Kennewick', 'Puyallup'],
  WV: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton', 'Waukesha', 'Brookfield', 'Oshkosh', 'Eau Claire'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette'],
  DC: ['Washington'],
}
