import { generateText } from 'ai'
import { getModel } from '@velora/ai'

// 8 review dimensions
export const REVIEW_DIMENSIONS = [
  'communication',
  'outcome',
  'responsiveness',
  'empathy',
  'expertise',
  'feeTransparency',
  'trialExperience',
  'satisfaction',
] as const

export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number]

export interface DimensionScores {
  communication: number
  outcome: number
  responsiveness: number
  empathy: number
  expertise: number
  feeTransparency: number
  trialExperience: number
  satisfaction: number
}

export interface ReviewQuoteData {
  text: string
  dimension: string
  sentiment: 'positive' | 'negative' | 'neutral'
  rating: number
}

export interface ReviewIntelligenceData {
  dimensions: DimensionScores
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  reviewCount: number
  bestQuotes: ReviewQuoteData[]
}

export interface AttorneyReview {
  id: string
  text: string | null
  rating: number
  publishedAt: Date | null
  authorName: string | null
}

const DIMENSION_EXTRACTION_PROMPT = `Analyze this attorney review and score each dimension 0-100.
Return JSON only: { "communication": 85, "outcome": 70, "responsiveness": 80, "empathy": 75, "expertise": 90, "feeTransparency": 60, "trialExperience": 50, "satisfaction": 85 }

Dimension definitions:
- communication: clarity, frequency, accessibility of attorney communication
- outcome: satisfaction with case results
- responsiveness: response time, availability
- empathy: emotional support, understanding shown
- expertise: legal knowledge, strategy quality
- feeTransparency: clarity of fees, value perception
- trialExperience: courtroom capability
- satisfaction: overall client satisfaction

If a dimension is not mentioned, score it 50 (neutral).

Review text: "{reviewText}"`

/**
 * Extract dimension scores from a single review using AI.
 * Falls back to rating-based heuristic if AI is unavailable.
 */
async function extractDimensionsFromReview(review: AttorneyReview): Promise<DimensionScores> {
  if (!review.text || review.text.trim().length < 10) {
    // No meaningful text — use rating as baseline for all dimensions
    const baseScore = review.rating * 20 // 1-5 -> 20-100
    return {
      communication: baseScore,
      outcome: baseScore,
      responsiveness: baseScore,
      empathy: baseScore,
      expertise: baseScore,
      feeTransparency: baseScore,
      trialExperience: baseScore,
      satisfaction: baseScore,
    }
  }

  try {
    const model = getModel('budget')
    const prompt = DIMENSION_EXTRACTION_PROMPT.replace('{reviewText}', review.text)

    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 200,
      temperature: 0.1,
    })

    // Parse JSON from response — handle markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>
    const scores: DimensionScores = {
      communication: clampScore(parsed.communication),
      outcome: clampScore(parsed.outcome),
      responsiveness: clampScore(parsed.responsiveness),
      empathy: clampScore(parsed.empathy),
      expertise: clampScore(parsed.expertise),
      feeTransparency: clampScore(parsed.feeTransparency),
      trialExperience: clampScore(parsed.trialExperience),
      satisfaction: clampScore(parsed.satisfaction),
    }
    return scores
  } catch (error) {
    console.warn('[ReviewIntelligence] AI extraction failed, using rating heuristic:', error)
    const baseScore = review.rating * 20
    return {
      communication: baseScore,
      outcome: baseScore,
      responsiveness: baseScore,
      empathy: baseScore,
      expertise: baseScore,
      feeTransparency: baseScore,
      trialExperience: baseScore,
      satisfaction: baseScore,
    }
  }
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : 50
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Aggregate dimension scores across multiple reviews.
 */
function aggregateDimensions(allScores: DimensionScores[]): DimensionScores {
  if (allScores.length === 0) {
    return {
      communication: 0,
      outcome: 0,
      responsiveness: 0,
      empathy: 0,
      expertise: 0,
      feeTransparency: 0,
      trialExperience: 0,
      satisfaction: 0,
    }
  }

  const sums: DimensionScores = {
    communication: 0,
    outcome: 0,
    responsiveness: 0,
    empathy: 0,
    expertise: 0,
    feeTransparency: 0,
    trialExperience: 0,
    satisfaction: 0,
  }

  for (const scores of allScores) {
    for (const dim of REVIEW_DIMENSIONS) {
      sums[dim] += scores[dim]
    }
  }

  const count = allScores.length
  return {
    communication: Math.round(sums.communication / count),
    outcome: Math.round(sums.outcome / count),
    responsiveness: Math.round(sums.responsiveness / count),
    empathy: Math.round(sums.empathy / count),
    expertise: Math.round(sums.expertise / count),
    feeTransparency: Math.round(sums.feeTransparency / count),
    trialExperience: Math.round(sums.trialExperience / count),
    satisfaction: Math.round(sums.satisfaction / count),
  }
}

/**
 * Detect review trend by comparing recent half vs older half average ratings.
 * Threshold: ±0.3 on 1-5 scale.
 */
export function detectTrend(
  reviews: AttorneyReview[],
  periodMonths: number = 12
): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (reviews.length < 4) return 'STABLE'

  // Sort by date, oldest first
  const sorted = [...reviews]
    .filter((r) => r.publishedAt != null)
    .sort((a, b) => (a.publishedAt!.getTime() - b.publishedAt!.getTime()))

  if (sorted.length < 4) return 'STABLE'

  // Filter to period
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - periodMonths)
  const inPeriod = sorted.filter((r) => r.publishedAt! >= cutoff)

  if (inPeriod.length < 4) return 'STABLE'

  const midpoint = Math.floor(inPeriod.length / 2)
  const olderHalf = inPeriod.slice(0, midpoint)
  const recentHalf = inPeriod.slice(midpoint)

  const avgOlder = olderHalf.reduce((sum, r) => sum + r.rating, 0) / olderHalf.length
  const avgRecent = recentHalf.reduce((sum, r) => sum + r.rating, 0) / recentHalf.length

  const diff = avgRecent - avgOlder
  if (diff >= 0.3) return 'IMPROVING'
  if (diff <= -0.3) return 'DECLINING'
  return 'STABLE'
}

/**
 * Extract top 3 representative excerpts from reviews for given dimensions.
 */
export function extractBestQuotes(
  reviews: AttorneyReview[],
  dimensions: ReviewDimension[]
): ReviewQuoteData[] {
  const quotes: ReviewQuoteData[] = []

  // Find reviews with text, sorted by rating
  const withText = reviews
    .filter((r) => r.text && r.text.trim().length > 20)
    .sort((a, b) => b.rating - a.rating)

  // Pick top 3 from highest-rated reviews
  for (const review of withText.slice(0, 3)) {
    const sentiment: 'positive' | 'negative' | 'neutral' =
      review.rating >= 4 ? 'positive' : review.rating <= 2 ? 'negative' : 'neutral'

    // Truncate to ~200 chars
    const text =
      review.text!.length > 200 ? review.text!.slice(0, 197) + '...' : review.text!

    quotes.push({
      text,
      dimension: dimensions[0] || 'satisfaction',
      sentiment,
      rating: review.rating,
    })
  }

  return quotes
}

/**
 * Full review intelligence analysis for an attorney's reviews.
 */
export async function analyzeReviews(
  reviews: AttorneyReview[]
): Promise<ReviewIntelligenceData> {
  if (reviews.length === 0) {
    return {
      dimensions: {
        communication: 0,
        outcome: 0,
        responsiveness: 0,
        empathy: 0,
        expertise: 0,
        feeTransparency: 0,
        trialExperience: 0,
        satisfaction: 0,
      },
      trend: 'STABLE',
      reviewCount: 0,
      bestQuotes: [],
    }
  }

  // Extract dimensions from each review (in batches to avoid rate limits)
  const allScores: DimensionScores[] = []
  const batchSize = 5
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(extractDimensionsFromReview))
    allScores.push(...results)
  }

  const dimensions = aggregateDimensions(allScores)
  const trend = detectTrend(reviews)
  const bestQuotes = extractBestQuotes(reviews, REVIEW_DIMENSIONS.slice())

  return {
    dimensions,
    trend,
    reviewCount: reviews.length,
    bestQuotes,
  }
}
