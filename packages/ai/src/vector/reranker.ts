/**
 * Hybrid re-ranker: combines vector similarity scores with structured metadata
 * from PostgreSQL to produce rich, ranked attorney results.
 *
 * Flow: Qdrant vector results → group by attorney → Prisma enrichment → composite scoring → ranked output
 */
import { prisma } from '@velora/db'

export interface VectorHit {
  id: string
  score: number
  payload: {
    reviewId: string
    attorneyId: string
    attorneyName: string
    text: string
    rating: number
    city?: string
    stateCode?: string
    practiceArea?: string
    authorName?: string
    publishedAt?: string
  }
}

export interface RankedAttorneyResult {
  attorney: {
    id: string
    name: string
    slug: string | null
    firmName: string | null
    city: string | null
    stateCode: string | null
    practiceAreas: string[]
    indexScore: number | null
    dimensions: {
      communication: number
      outcome: number
      responsiveness: number
      feeTransparency: number
    } | null
    trend: string | null
    bestQuotes: unknown
    reviewCount: number
    googleRating: number | null
  }
  relevantReviews: Array<{
    text: string
    rating: number
    score: number
    authorName?: string
    publishedAt?: string
  }>
  compositeScore: number
  scoreBreakdown: {
    vectorSimilarity: number
    indexScore: number
    recency: number
    reviewVolume: number
  }
}

interface RerankWeights {
  vectorSimilarity: number
  indexScore: number
  recency: number
  reviewVolume: number
}

const DEFAULT_WEIGHTS: RerankWeights = {
  vectorSimilarity: 0.40,
  indexScore: 0.30,
  recency: 0.15,
  reviewVolume: 0.15,
}

/**
 * Compute a recency score (0-100) based on how recent the most recent matching review is.
 * 100 = within last 30 days, decays to 0 at 3 years.
 */
function recencyScore(publishedAt?: string): number {
  if (!publishedAt) return 30 // unknown date gets a neutral score
  const ageMs = Date.now() - new Date(publishedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays <= 30) return 100
  if (ageDays >= 1095) return 0 // 3 years
  // Linear decay from 100 to 0 over 30-1095 days
  return Math.round(100 * (1 - (ageDays - 30) / (1095 - 30)))
}

/**
 * Compute a review volume score (0-100).
 * 50+ reviews = 100, scales linearly below that.
 */
function volumeScore(count: number): number {
  return Math.min(100, Math.round(count * 2))
}

/**
 * Take raw Qdrant vector hits, group by attorney, enrich from Prisma,
 * compute composite scores, and return ranked results.
 */
export async function rerankAndEnrich(
  vectorHits: VectorHit[],
  options?: {
    weights?: Partial<RerankWeights>
    maxAttorneys?: number
  }
): Promise<RankedAttorneyResult[]> {
  if (vectorHits.length === 0) return []

  const weights = { ...DEFAULT_WEIGHTS, ...options?.weights }
  const maxAttorneys = options?.maxAttorneys ?? 10

  // 1. Group vector hits by attorney
  const byAttorney = new Map<string, VectorHit[]>()
  for (const hit of vectorHits) {
    const aid = hit.payload.attorneyId
    if (!aid) continue
    const existing = byAttorney.get(aid) ?? []
    existing.push(hit)
    byAttorney.set(aid, existing)
  }

  // 2. Fetch full attorney profiles from Prisma
  const attorneyIds = Array.from(byAttorney.keys())
  const attorneys = await prisma.attorney.findMany({
    where: { id: { in: attorneyIds } },
    include: {
      attorneyIndex: true,
      reviewIntelligence: {
        select: {
          communication: true,
          outcome: true,
          responsiveness: true,
          feeTransparency: true,
          trend: true,
          bestQuotes: true,
          reviewCount: true,
        },
      },
      _count: { select: { reviews: true } },
    },
  })

  const attorneyMap = new Map(attorneys.map(a => [a.id, a]))

  // 3. Score and rank each attorney
  const results: RankedAttorneyResult[] = []

  for (const [attorneyId, hits] of byAttorney) {
    const attorney = attorneyMap.get(attorneyId)
    if (!attorney) continue

    // Sort hits by score descending, take top 5 for display
    const sortedHits = hits.sort((a, b) => b.score - a.score)
    const topHits = sortedHits.slice(0, 5)

    // Vector similarity: average of top hits, normalized to 0-100
    const avgVectorScore = sortedHits.reduce((s, h) => s + h.score, 0) / sortedHits.length
    const vectorComponent = Math.round(avgVectorScore * 100)

    // Attorney Index score (already 0-100)
    const idxScore = attorney.attorneyIndex?.score ?? 50

    // Recency: based on most recent matching review
    const mostRecentDate = sortedHits
      .map(h => h.payload.publishedAt)
      .filter(Boolean)
      .sort()
      .pop()
    const recencyComponent = recencyScore(mostRecentDate)

    // Review volume
    const reviewCount = attorney.reviewIntelligence?.reviewCount ?? attorney._count.reviews
    const volumeComponent = volumeScore(reviewCount)

    // Composite score
    const composite = Math.round(
      vectorComponent * weights.vectorSimilarity +
      idxScore * weights.indexScore +
      recencyComponent * weights.recency +
      volumeComponent * weights.reviewVolume
    )

    const ri = attorney.reviewIntelligence

    results.push({
      attorney: {
        id: attorney.id,
        name: attorney.name,
        slug: attorney.slug,
        firmName: attorney.firmName,
        city: attorney.city,
        stateCode: attorney.stateCode,
        practiceAreas: attorney.practiceAreas,
        indexScore: attorney.attorneyIndex?.score ?? null,
        dimensions: ri ? {
          communication: ri.communication,
          outcome: ri.outcome,
          responsiveness: ri.responsiveness,
          feeTransparency: ri.feeTransparency,
        } : null,
        trend: ri?.trend ?? null,
        bestQuotes: ri?.bestQuotes ?? null,
        reviewCount,
        googleRating: attorney.googleRating,
      },
      relevantReviews: topHits.map(h => ({
        text: h.payload.text,
        rating: h.payload.rating,
        score: h.score,
        authorName: h.payload.authorName,
        publishedAt: h.payload.publishedAt,
      })),
      compositeScore: composite,
      scoreBreakdown: {
        vectorSimilarity: vectorComponent,
        indexScore: idxScore,
        recency: recencyComponent,
        reviewVolume: volumeComponent,
      },
    })
  }

  // 4. Sort by composite score, return top N
  results.sort((a, b) => b.compositeScore - a.compositeScore)
  return results.slice(0, maxAttorneys)
}
