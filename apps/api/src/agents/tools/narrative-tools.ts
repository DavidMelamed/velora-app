import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { generateNarrative } from '../../services/narrative/generator'

/**
 * Narrative tools — wrap narrative generation services for agent use.
 */

export const generateNarrativeTool = createTool({
  id: 'generateNarrative',
  description: 'Generate a human-readable crash narrative for a specific crash ID using AI.',
  inputSchema: z.object({
    crashId: z.string().describe('The crash ID to generate a narrative for'),
  }),
  execute: async (input) => {
    try {
      const result = await generateNarrative(input.crashId)
      return {
        status: 'success',
        narrativeId: result.narrativeId,
        headline: result.content.headline,
        summary: result.content.summary,
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

export const checkQuality = createTool({
  id: 'checkQuality',
  description: 'Check narrative quality metrics: coverage, freshness, and content quality.',
  inputSchema: z.object({
    stateCode: z.string().length(2).optional().describe('Optional state filter'),
    limit: z.number().int().min(1).max(100).default(10).describe('Number of narratives to check'),
  }),
  execute: async (input) => {
    const where = input.stateCode ? { stateCode: input.stateCode } : {}

    // Count totals
    const totalCrashes = await prisma.crash.count({ where })
    const totalNarratives = await prisma.crashNarrative.count({
      where: input.stateCode ? { crash: { stateCode: input.stateCode } } : {},
    })

    // Get recent narratives for quality check
    const recentNarratives = await prisma.crashNarrative.findMany({
      where: input.stateCode ? { crash: { stateCode: input.stateCode } } : {},
      orderBy: { generatedAt: 'desc' },
      take: input.limit,
      select: {
        id: true,
        summary: true,
        modelTier: true,
        dataTier: true,
        generationMs: true,
        generatedAt: true,
      },
    })

    // Quality checks
    const qualityIssues: string[] = []
    const coverage = totalCrashes > 0 ? totalNarratives / totalCrashes : 0
    if (coverage < 0.5) {
      qualityIssues.push(`Low narrative coverage: ${(coverage * 100).toFixed(1)}%`)
    }

    for (const narrative of recentNarratives) {
      if (!narrative.summary || narrative.summary.length < 50) {
        qualityIssues.push(`Short summary in narrative ${narrative.id}`)
      }
      if (narrative.generationMs && narrative.generationMs > 30000) {
        qualityIssues.push(`Slow generation (${narrative.generationMs}ms) in narrative ${narrative.id}`)
      }
    }

    return {
      stateCode: input.stateCode ?? 'all',
      totalCrashes,
      totalNarratives,
      coverage: (coverage * 100).toFixed(1) + '%',
      recentNarrativeCount: recentNarratives.length,
      qualityIssues,
      modelTierDistribution: recentNarratives.reduce(
        (acc, n) => {
          const tier = n.modelTier || 'unknown'
          acc[tier] = (acc[tier] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
    }
  },
})

export const narrativeTools = {
  generateNarrative: generateNarrativeTool,
  checkQuality,
}
