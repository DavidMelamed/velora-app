import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { generateEqualizerBriefing, getCachedBriefing } from '../../services/equalizer/briefing-generator'

/**
 * Equalizer tools — wrap Equalizer services for agent use.
 */

export const findComparables = createTool({
  id: 'findComparables',
  description: 'Find comparable crashes for a given crash using 7-dimension matching.',
  inputSchema: z.object({
    crashId: z.string().describe('The crash ID to find comparables for'),
  }),
  execute: async (input) => {
    try {
      // Check if an equalizer already exists with cohort data
      const existing = await getCachedBriefing(input.crashId)
      if (existing) {
        const cohort = existing.comparableCohort as Record<string, unknown>
        return {
          status: 'cached',
          crashId: input.crashId,
          comparableCount: cohort?.count ?? 0,
          confidence: cohort?.confidence ?? 'UNKNOWN',
          injuryRate: cohort?.injuryRate ?? null,
        }
      }

      // Generate fresh (this also computes comparables)
      const result = await generateEqualizerBriefing(input.crashId)
      return {
        status: 'generated',
        crashId: input.crashId,
        comparableCount: result.comparableCohort.count,
        confidence: result.comparableCohort.confidence,
        injuryRate: result.comparableCohort.injuryRate,
        fatalityRate: result.comparableCohort.fatalityRate,
        topFactors: result.comparableCohort.topContributingFactors,
      }
    } catch (error) {
      return {
        status: 'error',
        crashId: input.crashId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const extractLiability = createTool({
  id: 'extractLiability',
  description: 'Extract liability signals from a crash record using rule-based analysis.',
  inputSchema: z.object({
    crashId: z.string().describe('The crash ID to analyze'),
  }),
  execute: async (input) => {
    try {
      // Check cached
      const existing = await getCachedBriefing(input.crashId)
      if (existing) {
        const signals = existing.liabilitySignals as Array<Record<string, unknown>>
        return {
          status: 'cached',
          crashId: input.crashId,
          signalCount: signals?.length ?? 0,
          signals: signals?.map((s) => ({
            signal: s.signal,
            type: s.type,
            confidence: s.confidence,
            humanReadable: s.humanReadable,
          })) ?? [],
        }
      }

      const result = await generateEqualizerBriefing(input.crashId)
      return {
        status: 'generated',
        crashId: input.crashId,
        signalCount: result.liabilitySignals.length,
        signals: result.liabilitySignals.map((s) => ({
          signal: s.signal,
          type: s.type,
          confidence: s.confidence,
          humanReadable: s.humanReadable,
        })),
      }
    } catch (error) {
      return {
        status: 'error',
        crashId: input.crashId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const computeSettlement = createTool({
  id: 'computeSettlement',
  description: 'Compute settlement context with ranges and state-specific factors for a crash.',
  inputSchema: z.object({
    crashId: z.string().describe('The crash ID to compute settlement for'),
  }),
  execute: async (input) => {
    try {
      const existing = await getCachedBriefing(input.crashId)
      if (existing) {
        const settlement = existing.settlementContext as Record<string, unknown>
        return {
          status: 'cached',
          crashId: input.crashId,
          range: settlement?.range ?? null,
          factors: settlement?.factors ?? [],
          stateFactors: settlement?.stateFactors ?? null,
          disclaimer: settlement?.disclaimer ?? '',
        }
      }

      const result = await generateEqualizerBriefing(input.crashId)
      return {
        status: 'generated',
        crashId: input.crashId,
        range: result.settlementContext.range,
        factors: result.settlementContext.factors,
        stateFactors: result.settlementContext.stateFactors,
        disclaimer: result.settlementContext.disclaimer,
      }
    } catch (error) {
      return {
        status: 'error',
        crashId: input.crashId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const equalizerTools = {
  findComparables,
  extractLiability,
  computeSettlement,
}
