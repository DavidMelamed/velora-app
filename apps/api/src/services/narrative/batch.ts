import { prisma, type CrashSeverity } from '@velora/db'
import { generateNarrative } from './generator'

export interface BatchOptions {
  stateCode?: string
  severity?: CrashSeverity
  limit?: number
  dryRun?: boolean
  batchSize?: number
  delayBetweenBatchesMs?: number
}

export interface BatchResult {
  generated: number
  failed: number
  skipped: number
  totalProcessed: number
  errors: Array<{ crashId: string; error: string }>
  estimatedCost: number
  durationMs: number
}

// Approximate cost per narrative by model tier (USD)
const COST_PER_NARRATIVE: Record<string, number> = {
  premium: 0.15, // Opus - ~2k input + ~2k output tokens
  standard: 0.03, // Sonnet
  budget: 0.005, // Haiku
}

function estimateCostForSeverity(severity: string | null): number {
  switch (severity) {
    case 'FATAL':
      return COST_PER_NARRATIVE.premium
    case 'SUSPECTED_SERIOUS_INJURY':
      return COST_PER_NARRATIVE.standard
    default:
      return COST_PER_NARRATIVE.budget
  }
}

/**
 * Generate narratives for multiple crashes in batches.
 * Respects rate limits and tracks budget.
 */
export async function batchGenerateNarratives(options: BatchOptions): Promise<BatchResult> {
  const {
    stateCode,
    severity,
    limit = 100,
    dryRun = false,
    batchSize = 20,
    delayBetweenBatchesMs = 5000,
  } = options

  const startTime = Date.now()

  // Build query filters
  const where: Record<string, unknown> = {
    // Skip crashes that already have narratives
    narratives: { none: {} },
  }

  if (stateCode) where.stateCode = stateCode
  if (severity) where.crashSeverity = severity

  // Get crashes needing narratives
  const crashes = await prisma.crash.findMany({
    where,
    select: {
      id: true,
      crashSeverity: true,
      stateCode: true,
    },
    take: limit,
    orderBy: [
      // Prioritize fatal/serious crashes
      { crashSeverity: 'asc' },
      { crashDate: 'desc' },
    ],
  })

  const result: BatchResult = {
    generated: 0,
    failed: 0,
    skipped: 0,
    totalProcessed: 0,
    errors: [],
    estimatedCost: 0,
    durationMs: 0,
  }

  if (dryRun) {
    // Dry run: just estimate cost and count
    result.totalProcessed = crashes.length
    result.skipped = 0
    result.estimatedCost = crashes.reduce(
      (sum, c) => sum + estimateCostForSeverity(c.crashSeverity),
      0
    )
    result.durationMs = Date.now() - startTime
    return result
  }

  // Process in batches
  for (let i = 0; i < crashes.length; i += batchSize) {
    const batch = crashes.slice(i, i + batchSize)

    for (const crash of batch) {
      result.totalProcessed++

      try {
        await generateNarrative(crash.id)
        result.generated++
        result.estimatedCost += estimateCostForSeverity(crash.crashSeverity)
      } catch (error) {
        result.failed++
        result.errors.push({
          crashId: crash.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Delay between batches to respect rate limits
    if (i + batchSize < crashes.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatchesMs))
    }
  }

  result.durationMs = Date.now() - startTime
  return result
}

/**
 * Get current narrative generation stats.
 */
export async function getNarrativeStats() {
  const [total, withNarratives, bySeverity] = await Promise.all([
    prisma.crash.count(),
    prisma.crashNarrative.count(),
    prisma.crash.groupBy({
      by: ['crashSeverity'],
      _count: true,
    }),
  ])

  const narrativesBySeverity = await prisma.crashNarrative.groupBy({
    by: ['modelTier'],
    _count: true,
  })

  return {
    totalCrashes: total,
    totalNarratives: withNarratives,
    coveragePercent: total > 0 ? ((withNarratives / total) * 100).toFixed(1) : '0.0',
    crashesBySeverity: bySeverity.map((s) => ({
      severity: s.crashSeverity,
      count: s._count,
    })),
    narrativesByTier: narrativesBySeverity.map((n) => ({
      tier: n.modelTier,
      count: n._count,
    })),
  }
}
