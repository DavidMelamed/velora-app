export interface ReviewTrendSample {
  id: string
  text: string | null
  rating: number
  publishedAt: Date | null
  authorName: string | null
}

/**
 * Detect review trend by comparing recent half vs older half average ratings.
 * Threshold: +/-0.3 on a 1-5 scale.
 */
export function detectTrend(
  reviews: ReviewTrendSample[],
  periodMonths: number = 12
): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (reviews.length < 4) return 'STABLE'

  const sorted = [...reviews]
    .filter((review) => review.publishedAt != null)
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime())

  if (sorted.length < 4) return 'STABLE'

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - periodMonths)
  const inPeriod = sorted.filter((review) => review.publishedAt! >= cutoff)

  if (inPeriod.length < 4) return 'STABLE'

  const midpoint = Math.floor(inPeriod.length / 2)
  const olderHalf = inPeriod.slice(0, midpoint)
  const recentHalf = inPeriod.slice(midpoint)

  const avgOlder =
    olderHalf.reduce((sum, review) => sum + review.rating, 0) / olderHalf.length
  const avgRecent =
    recentHalf.reduce((sum, review) => sum + review.rating, 0) / recentHalf.length

  const diff = avgRecent - avgOlder
  if (diff >= 0.3) return 'IMPROVING'
  if (diff <= -0.3) return 'DECLINING'
  return 'STABLE'
}
