import { prisma } from '@velora/db'
import type { DimensionScores } from '@/components/attorney/ReviewDimensions'
import type { ReviewStats, ReviewSnippet } from '@/components/attorney/ReviewInsights'

/**
 * Fetch review stats and snippets for an attorney.
 * Shared between the profile page and comparison page.
 */
export async function getAttorneyReviewData(attorneyId: string, totalReviews: number) {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [recentReviewCount, reviews] = await Promise.all([
    prisma.attorneyReview.count({
      where: { attorneyId, publishedAt: { gte: ninetyDaysAgo } },
    }),
    prisma.attorneyReview.findMany({
      where: { attorneyId },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        authorName: true,
        rating: true,
        text: true,
        publishedAt: true,
        isLocalGuide: true,
        ownerResponse: true,
        ownerResponseAt: true,
        photosCount: true,
        dimensions: true,
      },
    }),
  ])

  // Response rate
  const reviewsWithResponse = reviews.filter((r) => r.ownerResponse).length
  const responseRate =
    reviews.length > 0 ? Math.round((reviewsWithResponse / reviews.length) * 100) : 0

  // Dimension consistency (std deviation)
  const reviewDimArrays: Record<string, number[]> = {}
  for (const review of reviews) {
    if (review.dimensions && typeof review.dimensions === 'object') {
      const dims = review.dimensions as Record<string, number>
      for (const [key, value] of Object.entries(dims)) {
        if (typeof value === 'number') {
          if (!reviewDimArrays[key]) reviewDimArrays[key] = []
          reviewDimArrays[key].push(value)
        }
      }
    }
  }
  const dimensionConsistency: Partial<DimensionScores> = {}
  for (const [key, values] of Object.entries(reviewDimArrays)) {
    if (values.length >= 3) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
      ;(dimensionConsistency as Record<string, number>)[key] = Math.round(Math.sqrt(variance))
    }
  }

  const dataQuality: 'HIGH' | 'MEDIUM' | 'LOW' =
    totalReviews >= 30 ? 'HIGH' : totalReviews >= 10 ? 'MEDIUM' : 'LOW'

  const reviewSnippets: ReviewSnippet[] = reviews.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    text: r.text,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    isLocalGuide: r.isLocalGuide ?? false,
    ownerResponse: r.ownerResponse,
    ownerResponseAt: r.ownerResponseAt,
    photosCount: r.photosCount ?? 0,
  }))

  return {
    recentReviewCount,
    responseRate,
    dataQuality,
    dimensionConsistency:
      Object.keys(dimensionConsistency).length > 0
        ? (dimensionConsistency as DimensionScores)
        : null,
    reviewSnippets,
  }
}

/**
 * Build ReviewStats from attorney data + computed review data.
 */
export function buildReviewStats(
  totalReviews: number,
  recentReviewCount: number,
  responseRate: number,
  trend: string | null | undefined,
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW',
  dimensionConsistency: Partial<DimensionScores> | null,
): ReviewStats {
  return {
    totalReviews,
    recentReviewCount,
    responseRate,
    trend: (trend as ReviewStats['trend']) ?? null,
    dataQuality,
    dimensionConsistency: dimensionConsistency as DimensionScores | null,
  }
}
