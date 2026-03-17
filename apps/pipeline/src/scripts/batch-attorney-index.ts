/**
 * Batch compute Attorney Index for all attorneys using Google rating as proxy.
 * NO AI API calls — uses googleRating * 20 as dimension heuristic.
 *
 * Usage: DATABASE_URL=... pnpm tsx apps/pipeline/src/scripts/batch-attorney-index.ts
 */

import { prisma } from '@velora/db'

const BATCH_SIZE = 200

// Weights per spec
const WEIGHTS = {
  communication: 0.25,
  responsiveness: 0.20,
  outcome: 0.30,
  reviewCount: 0.15,
  specialty: 0.10,
} as const

const CRASH_PRACTICE_AREAS = [
  'personal_injury',
  'car_accident',
  'truck_accident',
  'motorcycle_accident',
  'pedestrian_accident',
]

function computeSpecialtyScore(practiceAreas: string[]): number {
  const normalized = practiceAreas.map(a => a.toLowerCase().replace(/[\s-]+/g, '_'))
  let matches = 0
  for (const area of CRASH_PRACTICE_AREAS) {
    if (normalized.includes(area)) matches++
  }
  return Math.min(100, matches * 25)
}

function getDataQualityTier(reviewCount: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (reviewCount >= 30) return 'HIGH'
  if (reviewCount >= 10) return 'MEDIUM'
  return 'LOW'
}

function detectTrend(reviews: Array<{ rating: number; publishedAt: Date | null }>): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (reviews.length < 4) return 'STABLE'

  const sorted = [...reviews]
    .filter(r => r.publishedAt)
    .sort((a, b) => (a.publishedAt!.getTime()) - (b.publishedAt!.getTime()))

  if (sorted.length < 4) return 'STABLE'

  const mid = Math.floor(sorted.length / 2)
  const olderAvg = sorted.slice(0, mid).reduce((s, r) => s + r.rating, 0) / mid
  const newerAvg = sorted.slice(mid).reduce((s, r) => s + r.rating, 0) / (sorted.length - mid)

  const diff = newerAvg - olderAvg
  if (diff > 0.3) return 'IMPROVING'
  if (diff < -0.3) return 'DECLINING'
  return 'STABLE'
}

async function main() {
  console.log('[Batch Attorney Index] Starting...')

  const totalAttorneys = await prisma.attorney.count()
  console.log(`[Batch] Total attorneys: ${totalAttorneys}`)

  let processed = 0
  let created = 0
  let skipped = 0
  let cursor: string | undefined

  while (true) {
    const attorneys = await prisma.attorney.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        googleRating: true,
        googleReviewCount: true,
        practiceAreas: true,
        reviews: {
          select: { rating: true, publishedAt: true, text: true },
          orderBy: { rating: 'desc' },
          take: 10,
        },
      },
    })

    if (attorneys.length === 0) break
    cursor = attorneys[attorneys.length - 1]!.id

    // Batch create ReviewIntelligence + AttorneyIndex
    for (const attorney of attorneys) {
      const rating = attorney.googleRating ?? 3.0
      const reviewCount = attorney.reviews.length || attorney.googleReviewCount || 0

      if (reviewCount === 0 && !attorney.googleRating) {
        skipped++
        continue
      }

      // Use google rating as dimension proxy (rating * 20 = 0-100 scale)
      const ratingScore = Math.min(100, Math.round(rating * 20))

      // Slightly vary dimensions based on rating to avoid all being identical
      const communication = Math.min(100, ratingScore + Math.round((rating - 3) * 5))
      const outcome = Math.min(100, ratingScore + Math.round((rating - 3) * 3))
      const responsiveness = Math.min(100, ratingScore + Math.round((rating - 3) * 4))
      const empathy = Math.min(100, ratingScore + Math.round((rating - 3) * 6))
      const expertise = Math.min(100, ratingScore + Math.round((rating - 3) * 2))
      const feeTransparency = Math.min(100, ratingScore - 5) // slightly lower, unknown
      const trialExperience = Math.min(100, ratingScore - 3) // slightly lower, unknown
      const satisfaction = ratingScore

      // Detect trend from actual reviews if available
      const trend = attorney.reviews.length >= 4
        ? detectTrend(attorney.reviews)
        : 'STABLE'

      // Extract best quotes from actual review text (no AI needed)
      const bestQuotes = attorney.reviews
        .filter(r => r.text && r.text.length > 30 && r.rating >= 4)
        .slice(0, 3)
        .map(r => ({
          text: r.text!.length > 200 ? r.text!.slice(0, 200) + '...' : r.text!,
          dimension: 'satisfaction',
          sentiment: 'positive' as const,
          rating: r.rating,
        }))

      // Compute index score
      const reviewCountScore = Math.min(100, reviewCount * 3)
      const specialtyScore = computeSpecialtyScore(attorney.practiceAreas)
      const compositeScore = Math.round(
        communication * WEIGHTS.communication +
        responsiveness * WEIGHTS.responsiveness +
        outcome * WEIGHTS.outcome +
        reviewCountScore * WEIGHTS.reviewCount +
        specialtyScore * WEIGHTS.specialty
      )
      const score = Math.max(0, Math.min(100, compositeScore))
      const dataQuality = getDataQualityTier(reviewCount)

      try {
        await prisma.$transaction([
          prisma.reviewIntelligence.upsert({
            where: { attorneyId: attorney.id },
            create: {
              attorneyId: attorney.id,
              communication,
              outcome,
              responsiveness,
              empathy,
              expertise,
              feeTransparency,
              trialExperience,
              satisfaction,
              trend,
              trendPeriodMonths: 12,
              bestQuotes: bestQuotes.length > 0 ? bestQuotes : [],
              reviewCount,
            },
            update: {
              communication,
              outcome,
              responsiveness,
              empathy,
              expertise,
              feeTransparency,
              trialExperience,
              satisfaction,
              trend,
              bestQuotes: bestQuotes.length > 0 ? bestQuotes : [],
              reviewCount,
              analyzedAt: new Date(),
            },
          }),
          prisma.attorneyIndex.upsert({
            where: { attorneyId: attorney.id },
            create: {
              attorneyId: attorney.id,
              score,
              communicationScore: communication,
              responsivenessScore: responsiveness,
              outcomeScore: outcome,
              reviewCountScore,
              specialtyScore,
              reviewCount,
              dataQuality,
            },
            update: {
              score,
              communicationScore: communication,
              responsivenessScore: responsiveness,
              outcomeScore: outcome,
              reviewCountScore,
              specialtyScore,
              reviewCount,
              dataQuality,
              computedAt: new Date(),
            },
          }),
        ])
        created++
      } catch (err) {
        console.warn(`[Batch] Failed for ${attorney.id}:`, err instanceof Error ? err.message : err)
      }
    }

    processed += attorneys.length
    console.log(`[Batch] Processed: ${processed}/${totalAttorneys} | Scored: ${created} | Skipped: ${skipped}`)
  }

  console.log(`\n[Batch Attorney Index] DONE`)
  console.log(`  Total processed: ${processed}`)
  console.log(`  Index scores created: ${created}`)
  console.log(`  Skipped (no data): ${skipped}`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[Batch] Fatal error:', err)
  process.exit(1)
})
