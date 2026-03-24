'use client'

import type { DimensionScores } from './ReviewDimensions'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReviewStats {
  totalReviews: number
  recentReviewCount: number // reviews in last 90 days
  responseRate: number // 0-100, % of reviews with owner response
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | null
  dataQuality: 'HIGH' | 'MEDIUM' | 'LOW'
  /** Per-dimension standard deviations (0-100 scale). Lower = more consistent. */
  dimensionConsistency: Partial<DimensionScores> | null
}

export interface ReviewSnippet {
  id: string
  authorName: string | null
  rating: number
  text: string | null
  publishedAt: string | null // ISO date
  isLocalGuide: boolean
  ownerResponse: string | null
  ownerResponseAt: string | null
  photosCount: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  communication: 'Communication',
  outcome: 'Outcome',
  responsiveness: 'Responsiveness',
  empathy: 'Empathy',
  expertise: 'Expertise',
  feeTransparency: 'Fee Transparency',
  trialExperience: 'Trial Experience',
  satisfaction: 'Satisfaction',
}

function getConsistencyBadges(
  consistency: Partial<DimensionScores> | null,
  scores: DimensionScores | null,
): { label: string; key: string }[] {
  if (!consistency || !scores) return []
  const badges: { label: string; key: string }[] = []

  for (const [key, stdDev] of Object.entries(consistency)) {
    const dimKey = key as keyof DimensionScores
    // Low std deviation (<15) AND high score (>70) = consistently high
    if (stdDev < 15 && scores[dimKey] >= 70) {
      badges.push({ label: DIMENSION_LABELS[dimKey], key })
    }
  }
  // Return top 3 most consistent high-scoring dimensions
  return badges.slice(0, 3)
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ─── Review Insights Bar ────────────────────────────────────────────────────

interface ReviewInsightsProps {
  stats: ReviewStats
  dimensions: DimensionScores | null
}

export function ReviewInsights({ stats, dimensions }: ReviewInsightsProps) {
  const consistencyBadges = getConsistencyBadges(stats.dimensionConsistency, dimensions)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Review Snapshot
      </h3>

      {/* ── Key metrics row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Volume + confidence */}
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalReviews}
          </div>
          <div className="text-xs text-gray-500">Total Reviews</div>
          <DataQualityBadge tier={stats.dataQuality} />
        </div>

        {/* Recency */}
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.recentReviewCount}
          </div>
          <div className="text-xs text-gray-500">Last 90 Days</div>
          {stats.recentReviewCount >= 5 ? (
            <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Active
            </span>
          ) : stats.recentReviewCount > 0 ? (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Moderate
            </span>
          ) : (
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              Inactive
            </span>
          )}
        </div>

        {/* Response rate */}
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.responseRate}%
          </div>
          <div className="text-xs text-gray-500">Response Rate</div>
          {stats.responseRate >= 80 ? (
            <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Highly Responsive
            </span>
          ) : stats.responseRate >= 40 ? (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Somewhat Responsive
            </span>
          ) : (
            <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
              Low Response
            </span>
          )}
        </div>

        {/* Trend */}
        <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
          <div className="text-2xl font-bold">
            {stats.trend === 'IMPROVING' && (
              <span className="text-green-600 dark:text-green-400">&#8593;</span>
            )}
            {stats.trend === 'DECLINING' && (
              <span className="text-red-500 dark:text-red-400">&#8595;</span>
            )}
            {stats.trend === 'STABLE' && (
              <span className="text-gray-500">&#8596;</span>
            )}
            {!stats.trend && (
              <span className="text-gray-400">&mdash;</span>
            )}
          </div>
          <div className="text-xs text-gray-500">12-Month Trend</div>
          {stats.trend && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                stats.trend === 'IMPROVING'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : stats.trend === 'DECLINING'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {stats.trend.charAt(0) + stats.trend.slice(1).toLowerCase()}
            </span>
          )}
        </div>
      </div>

      {/* ── Consistency badges ── */}
      {consistencyBadges.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            Consistently Rated High
          </p>
          <div className="flex flex-wrap gap-2">
            {consistencyBadges.map((badge) => (
              <span
                key={badge.key}
                className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Data Quality Badge ─────────────────────────────────────────────────────

function DataQualityBadge({ tier }: { tier: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const styles = {
    HIGH: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    LOW: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  }
  const labels = {
    HIGH: 'High Confidence',
    MEDIUM: 'Moderate Confidence',
    LOW: 'Limited Data',
  }

  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[tier]}`}
    >
      {labels[tier]}
    </span>
  )
}

// ─── Client Reviews List (with owner responses) ─────────────────────────────

interface ClientReviewsProps {
  reviews: ReviewSnippet[]
  bestQuotes?: string[]
}

export function ClientReviews({ reviews, bestQuotes }: ClientReviewsProps) {
  if (reviews.length === 0 && (!bestQuotes || bestQuotes.length === 0)) return null

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Client Reviews
      </h2>

      {/* Actual reviews with owner responses */}
      {reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Header: author, rating, date, badges */}
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {review.authorName ?? 'Anonymous'}
                    </span>
                    {review.isLocalGuide && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        Local Guide
                      </span>
                    )}
                    {review.photosCount > 0 && (
                      <span className="text-[10px] text-gray-400">
                        {review.photosCount} photo{review.photosCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    {review.publishedAt && (
                      <span className="text-xs text-gray-400">
                        {formatRelativeDate(review.publishedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Review text */}
              {review.text && (
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {review.text}
                </p>
              )}

              {/* Owner response */}
              {review.ownerResponse && (
                <div className="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-3 dark:border-blue-600 dark:bg-blue-900/20">
                  <div className="mb-1 flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      Response from owner
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                    {review.ownerResponse}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : bestQuotes && bestQuotes.length > 0 ? (
        /* Fallback: show bestQuotes if no individual reviews fetched */
        <div className="space-y-3">
          {bestQuotes.map((text, i) => (
            <blockquote
              key={i}
              className="rounded-lg border-l-4 border-blue-500 bg-gray-50 p-4 text-sm italic text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              &ldquo;{text}&rdquo;
            </blockquote>
          ))}
        </div>
      ) : null}
    </section>
  )
}
