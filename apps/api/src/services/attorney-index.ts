import type { ReviewIntelligenceData } from './review-intelligence'

export type DataQualityTier = 'HIGH' | 'MEDIUM' | 'LOW'

export interface AttorneyIndexResult {
  score: number
  components: Record<string, number>
  dataQuality: DataQualityTier
}

// Exact weights per spec
const WEIGHTS = {
  communication: 0.25,
  responsiveness: 0.20,
  outcome: 0.30,
  reviewCount: 0.15,
  specialty: 0.10,
} as const

// Practice areas that match crash-related specializations
const CRASH_PRACTICE_AREAS = [
  'personal_injury',
  'car_accident',
  'truck_accident',
  'motorcycle_accident',
  'pedestrian_accident',
] as const

/**
 * Compute review count score: Math.min(100, reviewCount * 3)
 * 33+ reviews = 100
 */
export function computeReviewCountScore(reviewCount: number): number {
  return Math.min(100, reviewCount * 3)
}

/**
 * Compute specialty match score based on practice areas.
 * Count matching areas from crash-related list, * 25, cap at 100.
 */
export function computeSpecialtyScore(
  practiceAreas: string[],
  _crashType?: string
): number {
  const normalizedAreas = practiceAreas.map((a) => a.toLowerCase().replace(/[\s-]+/g, '_'))
  let matchCount = 0

  for (const area of CRASH_PRACTICE_AREAS) {
    if (normalizedAreas.includes(area)) {
      matchCount++
    }
  }

  return Math.min(100, matchCount * 25)
}

/**
 * Determine data quality tier based on review count.
 * HIGH: 30+ reviews, MEDIUM: 10-29, LOW: <10
 */
export function getDataQualityTier(reviewCount: number): DataQualityTier {
  if (reviewCount >= 30) return 'HIGH'
  if (reviewCount >= 10) return 'MEDIUM'
  return 'LOW'
}

/**
 * Compute composite Attorney Index score (0-100) with exact weights.
 *
 * Weights:
 *   communication: 0.25
 *   responsiveness: 0.20
 *   outcome: 0.30
 *   reviewCount: 0.15
 *   specialty: 0.10
 */
export function computeAttorneyIndex(
  reviewIntelligence: ReviewIntelligenceData,
  practiceAreas: string[],
  crashType?: string
): AttorneyIndexResult {
  const { dimensions, reviewCount } = reviewIntelligence

  const communicationScore = dimensions.communication
  const responsivenessScore = dimensions.responsiveness
  const outcomeScore = dimensions.outcome
  const reviewCountScore = computeReviewCountScore(reviewCount)
  const specialtyScore = computeSpecialtyScore(practiceAreas, crashType)

  const compositeScore = Math.round(
    communicationScore * WEIGHTS.communication +
    responsivenessScore * WEIGHTS.responsiveness +
    outcomeScore * WEIGHTS.outcome +
    reviewCountScore * WEIGHTS.reviewCount +
    specialtyScore * WEIGHTS.specialty
  )

  return {
    score: Math.max(0, Math.min(100, compositeScore)),
    components: {
      communication: communicationScore,
      responsiveness: responsivenessScore,
      outcome: outcomeScore,
      reviewCount: reviewCountScore,
      specialty: specialtyScore,
    },
    dataQuality: getDataQualityTier(reviewCount),
  }
}
