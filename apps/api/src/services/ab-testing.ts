/**
 * A/B Testing Infrastructure — Deterministic variant assignment with experiment lifecycle.
 */

import { prisma } from '@velora/db'
import type { Prisma } from '@velora/db'

export interface ExperimentVariant {
  id: string
  name: string
  promptVersionId?: string
  weight: number // 0-1, all weights should sum to 1
}

export interface ExperimentRecord {
  id: string
  name: string
  signature: string
  variants: ExperimentVariant[]
  status: 'RUNNING' | 'COMPLETED' | 'PROMOTED'
  winnerId: string | null
  startedAt: Date
  completedAt: Date | null
}

export interface VariantAssignment {
  experimentId: string
  variantId: string
  variantName: string
}

/**
 * Deterministic variant assignment via hash.
 * Same experimentId + sessionId always returns the same variant.
 */
export function getOrAssignVariant(
  experimentId: string,
  sessionId: string,
  variants: ExperimentVariant[],
): ExperimentVariant {
  if (variants.length === 0) {
    throw new Error('Experiment has no variants')
  }

  // Simple deterministic hash
  const hash = deterministicHash(`${experimentId}:${sessionId}`)
  const bucket = hash % 1000 // 0-999

  // Distribute across variants by weight
  let cumulativeWeight = 0
  for (const variant of variants) {
    cumulativeWeight += variant.weight * 1000
    if (bucket < cumulativeWeight) {
      return variant
    }
  }

  // Fallback to last variant (shouldn't happen if weights sum to 1)
  return variants[variants.length - 1]!
}

/**
 * Create a new experiment.
 */
export async function createExperiment(
  name: string,
  signature: string,
  variants: Omit<ExperimentVariant, 'id'>[],
): Promise<ExperimentRecord> {
  // Validate weights sum to ~1
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  if (Math.abs(totalWeight - 1) > 0.01) {
    throw new Error(`Variant weights must sum to 1. Got: ${totalWeight}`)
  }

  // Generate variant IDs
  const variantsWithIds: ExperimentVariant[] = variants.map((v, i) => ({
    ...v,
    id: `var_${Date.now()}_${i}`,
  }))

  const experiment = await prisma.experiment.create({
    data: {
      name,
      signature,
      variants: variantsWithIds as unknown as Prisma.InputJsonValue,
      status: 'RUNNING',
    },
  })

  return mapToRecord(experiment)
}

/**
 * Get active experiments for a signature.
 */
export async function getActiveExperiments(signature: string): Promise<ExperimentRecord[]> {
  const experiments = await prisma.experiment.findMany({
    where: { signature, status: 'RUNNING' },
  })

  return experiments.map(mapToRecord)
}

/**
 * Get a specific experiment.
 */
export async function getExperiment(experimentId: string): Promise<ExperimentRecord | null> {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
  })

  return experiment ? mapToRecord(experiment) : null
}

/**
 * Evaluate an experiment — compare variant metrics and declare a winner.
 */
export async function evaluateExperiment(experimentId: string): Promise<{
  winnerId: string | null
  winnerName: string | null
  results: Array<{
    variantId: string
    variantName: string
    sampleSize: number
    metrics: {
      narrativeApprovalRate: number
      equalizerUsefulRate: number
      avgTimeOnPage: number
      compositeScore: number
    }
  }>
}> {
  const experiment = await prisma.experiment.findUniqueOrThrow({
    where: { id: experimentId },
  })

  const variants = experiment.variants as unknown as ExperimentVariant[]

  const results = await Promise.all(
    variants.map(async (variant) => {
      // Get feedback events for this variant
      const events = await prisma.feedbackEvent.findMany({
        where: {
          experimentId,
          variant: variant.id,
        },
      })

      // Compute metrics
      const thumbsEvents = events.filter((e) => e.type === 'NARRATIVE_THUMBS')
      const thumbsUp = thumbsEvents.filter(
        (e) => (e.value as Record<string, unknown>).thumbs === 'up',
      ).length
      const narrativeApprovalRate =
        thumbsEvents.length > 0 ? thumbsUp / thumbsEvents.length : 0

      const equalizerEvents = events.filter((e) => e.type === 'EQUALIZER_USEFUL')
      const equalizerYes = equalizerEvents.filter(
        (e) => (e.value as Record<string, unknown>).useful === true,
      ).length
      const equalizerUsefulRate =
        equalizerEvents.length > 0 ? equalizerYes / equalizerEvents.length : 0

      const timeEvents = events.filter((e) => e.type === 'TIME_ON_PAGE')
      const avgTimeOnPage =
        timeEvents.length > 0
          ? timeEvents.reduce(
              (sum, e) => sum + ((e.value as Record<string, unknown>).seconds as number || 0),
              0,
            ) / timeEvents.length
          : 0

      // Composite: 50% narrative, 30% equalizer, 20% time normalized to 0-1 (60s = 1.0)
      const compositeScore =
        narrativeApprovalRate * 0.5 +
        equalizerUsefulRate * 0.3 +
        Math.min(avgTimeOnPage / 60, 1) * 0.2

      return {
        variantId: variant.id,
        variantName: variant.name,
        sampleSize: events.length,
        metrics: {
          narrativeApprovalRate: Math.round(narrativeApprovalRate * 1000) / 1000,
          equalizerUsefulRate: Math.round(equalizerUsefulRate * 1000) / 1000,
          avgTimeOnPage: Math.round(avgTimeOnPage * 10) / 10,
          compositeScore: Math.round(compositeScore * 1000) / 1000,
        },
      }
    }),
  )

  // Find winner (highest composite score with minimum sample size)
  const MIN_SAMPLE_SIZE = 10
  const qualifiedResults = results.filter((r) => r.sampleSize >= MIN_SAMPLE_SIZE)
  const winner = qualifiedResults.sort(
    (a, b) => b.metrics.compositeScore - a.metrics.compositeScore,
  )[0]

  // Update experiment
  if (winner) {
    await prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: 'COMPLETED',
        winnerId: winner.variantId,
        completedAt: new Date(),
      },
    })
  }

  return {
    winnerId: winner?.variantId ?? null,
    winnerName: winner?.variantName ?? null,
    results,
  }
}

/**
 * Get the variant assignment for a session within active experiments of a signature.
 */
export async function getVariantForSession(
  signature: string,
  sessionId: string,
): Promise<VariantAssignment | null> {
  const experiments = await getActiveExperiments(signature)
  if (experiments.length === 0) return null

  // Use the first active experiment (one experiment per signature at a time)
  const experiment = experiments[0]!
  const variant = getOrAssignVariant(experiment.id, sessionId, experiment.variants)

  return {
    experimentId: experiment.id,
    variantId: variant.id,
    variantName: variant.name,
  }
}

// ═══════════════════════════════════════════════════
//  Internal helpers
// ═══════════════════════════════════════════════════

/**
 * Simple deterministic hash function (DJB2 variant).
 */
function deterministicHash(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function mapToRecord(experiment: {
  id: string
  name: string
  signature: string
  variants: unknown
  status: string
  winnerId: string | null
  startedAt: Date
  completedAt: Date | null
}): ExperimentRecord {
  return {
    id: experiment.id,
    name: experiment.name,
    signature: experiment.signature,
    variants: experiment.variants as ExperimentVariant[],
    status: experiment.status as ExperimentRecord['status'],
    winnerId: experiment.winnerId,
    startedAt: experiment.startedAt,
    completedAt: experiment.completedAt,
  }
}
