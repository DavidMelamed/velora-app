/**
 * Adaptive Model Router — Dynamic model selection based on feedback data.
 *
 * Rules:
 * - Approval rate > 90%: allow budget tier (Haiku)
 * - Approval rate 70-90%: standard tier (Sonnet)
 * - Approval rate 50-70%: force standard tier
 * - Approval rate < 50%: force premium tier (Opus)
 */

import { prisma } from '@velora/db'
import type { ModelTier } from '../gateway'

interface RoutingDecision {
  tier: ModelTier
  reason: string
  approvalRate: number | null
  sampleSize: number
  cached: boolean
}

// In-memory cache with 5-minute TTL
const routingCache = new Map<string, { decision: RoutingDecision; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get the recommended model tier for a crash based on its archetype's feedback data.
 */
export async function getAdaptiveModelTier(
  archetypeId: string | null,
  crashSeverity?: string | null,
): Promise<RoutingDecision> {
  // Fatal crashes always get premium — non-negotiable
  if (crashSeverity === 'FATAL') {
    return {
      tier: 'premium',
      reason: 'Fatal crash always uses premium tier',
      approvalRate: null,
      sampleSize: 0,
      cached: false,
    }
  }

  // If no archetype, use severity-based default routing
  if (!archetypeId) {
    return getDefaultRoutingBySeverity(crashSeverity)
  }

  // Check cache
  const cacheKey = `adaptive:${archetypeId}`
  const cached = routingCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.decision, cached: true }
  }

  // Query recent feedback aggregates for this archetype
  const aggregates = await prisma.feedbackAggregate.findMany({
    where: { archetypeId },
    orderBy: { period: 'desc' },
    take: 14, // Last 2 weeks
  })

  if (aggregates.length === 0) {
    const decision = getDefaultRoutingBySeverity(crashSeverity)
    cacheDecision(cacheKey, decision)
    return decision
  }

  // Compute weighted approval rate (recent days weighted more)
  let totalWeight = 0
  let weightedApproval = 0
  let totalSamples = 0

  for (let i = 0; i < aggregates.length; i++) {
    const agg = aggregates[i]!
    const recencyWeight = 1 / (i + 1) // Most recent has highest weight
    const sampleWeight = agg.sampleSize * recencyWeight
    weightedApproval += agg.narrativeApprovalRate * sampleWeight
    totalWeight += sampleWeight
    totalSamples += agg.sampleSize
  }

  const approvalRate = totalWeight > 0 ? weightedApproval / totalWeight : 0.5

  // Route based on approval rate
  let tier: ModelTier
  let reason: string

  if (approvalRate > 0.9) {
    tier = 'budget'
    reason = `High approval rate (${(approvalRate * 100).toFixed(1)}%) — budget tier sufficient`
  } else if (approvalRate > 0.7) {
    tier = 'standard'
    reason = `Good approval rate (${(approvalRate * 100).toFixed(1)}%) — standard tier`
  } else if (approvalRate > 0.5) {
    tier = 'standard'
    reason = `Moderate approval rate (${(approvalRate * 100).toFixed(1)}%) — forcing standard tier`
  } else {
    tier = 'premium'
    reason = `Low approval rate (${(approvalRate * 100).toFixed(1)}%) — forcing premium tier for quality`
  }

  const decision: RoutingDecision = {
    tier,
    reason,
    approvalRate: Math.round(approvalRate * 1000) / 1000,
    sampleSize: totalSamples,
    cached: false,
  }

  cacheDecision(cacheKey, decision)
  return decision
}

/**
 * Default routing when no feedback data is available.
 */
function getDefaultRoutingBySeverity(severity?: string | null): RoutingDecision {
  let tier: ModelTier
  let reason: string

  switch (severity) {
    case 'FATAL':
      tier = 'premium'
      reason = 'Fatal crashes always use premium tier'
      break
    case 'SERIOUS_INJURY':
      tier = 'standard'
      reason = 'Serious injury default: standard tier'
      break
    case 'MINOR_INJURY':
      tier = 'budget'
      reason = 'Minor injury default: budget tier'
      break
    case 'PROPERTY_DAMAGE_ONLY':
      tier = 'budget'
      reason = 'Property damage only default: budget tier'
      break
    default:
      tier = 'standard'
      reason = 'Unknown severity default: standard tier'
  }

  return {
    tier,
    reason,
    approvalRate: null,
    sampleSize: 0,
    cached: false,
  }
}

/**
 * Clear the routing cache (useful for testing or after GEPA promotions).
 */
export function clearRoutingCache(): void {
  routingCache.clear()
}

/**
 * Get all cached routing decisions (for dashboard/debugging).
 */
export function getCachedDecisions(): Array<{
  key: string
  decision: RoutingDecision
  expiresIn: number
}> {
  const now = Date.now()
  const results: Array<{ key: string; decision: RoutingDecision; expiresIn: number }> = []

  for (const [key, entry] of routingCache) {
    if (entry.expiresAt > now) {
      results.push({
        key,
        decision: entry.decision,
        expiresIn: Math.round((entry.expiresAt - now) / 1000),
      })
    }
  }

  return results
}

function cacheDecision(key: string, decision: RoutingDecision): void {
  routingCache.set(key, {
    decision,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}
