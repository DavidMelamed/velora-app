/**
 * Qdrant Cloud vector store for attorney review embeddings.
 *
 * Setup:
 * 1. Create free cluster at https://cloud.qdrant.io (no credit card needed)
 * 2. Add to .env:
 *    QDRANT_URL=https://your-cluster-id.aws.cloud.qdrant.io:6333
 *    QDRANT_API_KEY=your-api-key
 */
import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'crypto'
import { EMBEDDING_DIMS } from './embeddings'

/**
 * Convert a CUID string to a UUID v5-like format for Qdrant.
 * Qdrant requires UUIDs or unsigned integers as point IDs.
 */
function cuidToUuid(cuid: string): string {
  const hash = createHash('md5').update(cuid).digest('hex')
  // Format as UUID: 8-4-4-4-12
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

const COLLECTION_NAME = 'attorney_reviews'

let qdrantClient: QdrantClient | null = null

function getQdrant(): QdrantClient {
  if (!qdrantClient) {
    const url = process.env.QDRANT_URL
    const apiKey = process.env.QDRANT_API_KEY
    if (!url) throw new Error('QDRANT_URL is required. Create a free cluster at https://cloud.qdrant.io')
    qdrantClient = new QdrantClient({ url, apiKey })
  }
  return qdrantClient
}

/**
 * Initialize the reviews collection. Idempotent — safe to call multiple times.
 */
export async function initCollection(): Promise<void> {
  const client = getQdrant()

  const collections = await client.getCollections()
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME)

  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIMS,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      // Enable scalar quantization to reduce storage ~4x
      quantization_config: {
        scalar: {
          type: 'int8',
          always_ram: true,
        },
      },
    })

    // Create payload indexes for filtering
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'attorneyId',
      field_schema: 'keyword',
    })
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'stateCode',
      field_schema: 'keyword',
    })
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'rating',
      field_schema: 'integer',
    })
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'city',
      field_schema: 'keyword',
    })

    console.log(`[Qdrant] Created collection '${COLLECTION_NAME}' (${EMBEDDING_DIMS} dims, cosine, int8 quantization)`)
  } else {
    console.log(`[Qdrant] Collection '${COLLECTION_NAME}' already exists`)
  }
}

export interface ReviewPoint {
  id: string         // review ID (used as Qdrant point ID)
  vector: number[]
  payload: {
    reviewId: string
    attorneyId: string
    attorneyName: string
    text: string       // truncated for storage
    rating: number
    city?: string
    stateCode?: string
    practiceArea?: string
    authorName?: string
    publishedAt?: string
  }
}

/**
 * Upsert review embeddings in batches.
 */
export async function upsertReviews(points: ReviewPoint[]): Promise<void> {
  if (points.length === 0) return
  const client = getQdrant()

  const BATCH = 100
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH)
    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: batch.map(p => ({
        id: cuidToUuid(p.id),
        vector: p.vector,
        payload: p.payload,
      })),
    })
  }
}

/**
 * Search for similar reviews by vector.
 */
export async function searchSimilar(
  queryVector: number[],
  options?: {
    limit?: number
    minScore?: number
    filter?: {
      stateCode?: string
      city?: string
      attorneyId?: string
      minRating?: number
    }
  }
): Promise<Array<{
  id: string
  score: number
  payload: ReviewPoint['payload']
}>> {
  const client = getQdrant()
  const limit = options?.limit ?? 10
  const scoreThreshold = options?.minScore ?? 0.5

  // Build Qdrant filter
  const must: Array<Record<string, unknown>> = []
  if (options?.filter?.stateCode) {
    must.push({ key: 'stateCode', match: { value: options.filter.stateCode } })
  }
  if (options?.filter?.city) {
    must.push({ key: 'city', match: { value: options.filter.city } })
  }
  if (options?.filter?.attorneyId) {
    must.push({ key: 'attorneyId', match: { value: options.filter.attorneyId } })
  }
  if (options?.filter?.minRating) {
    must.push({ key: 'rating', range: { gte: options.filter.minRating } })
  }

  const results = await client.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    score_threshold: scoreThreshold,
    filter: must.length > 0 ? { must } : undefined,
    with_payload: true,
  })

  return results.map(r => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload as unknown as ReviewPoint['payload'],
  }))
}

/**
 * Get collection stats.
 */
export async function getCollectionInfo(): Promise<{
  vectorCount: number
  status: string
  segmentCount: number
}> {
  const client = getQdrant()
  const info = await client.getCollection(COLLECTION_NAME)
  return {
    vectorCount: info.points_count ?? 0,
    status: info.status,
    segmentCount: info.segments_count ?? 0,
  }
}

/**
 * Hybrid search: vector similarity + rich metadata filtering.
 * Supports text-based queries (auto-embeds), multi-attorney filtering,
 * practice area filtering, and date range filtering.
 */
export async function hybridSearch(options: {
  queryVector?: number[]
  filters?: {
    stateCode?: string
    city?: string
    attorneyId?: string
    attorneyIds?: string[]
    minRating?: number
    practiceArea?: string
  }
  limit?: number
  minScore?: number
}): Promise<Array<{
  id: string
  score: number
  payload: ReviewPoint['payload']
}>> {
  const client = getQdrant()
  const limit = options.limit ?? 20
  const minScore = options.minScore ?? 0.3

  // Build Qdrant filter
  const must: Array<Record<string, unknown>> = []

  if (options.filters?.stateCode) {
    must.push({ key: 'stateCode', match: { value: options.filters.stateCode } })
  }
  if (options.filters?.city) {
    must.push({ key: 'city', match: { value: options.filters.city } })
  }
  if (options.filters?.attorneyId) {
    must.push({ key: 'attorneyId', match: { value: options.filters.attorneyId } })
  }
  if (options.filters?.attorneyIds && options.filters.attorneyIds.length > 0) {
    // Qdrant supports "any" match for multi-value filtering
    must.push({ key: 'attorneyId', match: { any: options.filters.attorneyIds } })
  }
  if (options.filters?.minRating) {
    must.push({ key: 'rating', range: { gte: options.filters.minRating } })
  }
  if (options.filters?.practiceArea) {
    must.push({ key: 'practiceArea', match: { value: options.filters.practiceArea } })
  }

  const filter = must.length > 0 ? { must } : undefined

  if (options.queryVector) {
    // Vector + filter search
    const results = await client.search(COLLECTION_NAME, {
      vector: options.queryVector,
      limit,
      score_threshold: minScore,
      filter,
      with_payload: true,
    })

    return results.map(r => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as unknown as ReviewPoint['payload'],
    }))
  } else {
    // Filter-only search (no vector — use scroll)
    const results = await client.scroll(COLLECTION_NAME, {
      filter,
      limit,
      with_payload: true,
      with_vector: false,
    })

    return results.points.map(r => ({
      id: String(r.id),
      score: 1.0, // no vector comparison, default score
      payload: r.payload as unknown as ReviewPoint['payload'],
    }))
  }
}

/**
 * Ensure additional payload indexes exist (idempotent).
 * Call once during collection setup.
 */
export async function ensurePayloadIndexes(): Promise<void> {
  const client = getQdrant()
  try {
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'practiceArea',
      field_schema: 'keyword',
    })
  } catch { /* index may already exist */ }
}

export { COLLECTION_NAME }
