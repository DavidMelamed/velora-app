import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { prisma } from '@velora/db'

/**
 * Pipeline tools — wrap data pipeline operations for agent use.
 * These call the pipeline service functions or query the database directly
 * since the pipeline app is a separate workspace.
 */

export const fetchFARS = createTool({
  id: 'fetchFARS',
  description: 'Fetch crash data from NHTSA FARS (Fatality Analysis Reporting System) for a given state and year range.',
  inputSchema: z.object({
    stateCode: z.string().length(2).describe('2-letter state code'),
    fromYear: z.number().int().min(2015).max(2025).describe('Start year'),
    toYear: z.number().int().min(2015).max(2025).describe('End year'),
    limit: z.number().int().min(1).max(1000).default(100).describe('Max records to fetch'),
  }),
  execute: async (input) => {
    // Check if there are recent pipeline runs for FARS + this state
    const recentRun = await prisma.pipelineRun.findFirst({
      where: {
        dataSource: { type: 'FARS' },
        status: 'COMPLETED',
      },
      orderBy: { startedAt: 'desc' },
    })

    // Count existing crashes for this state
    const existingCount = await prisma.crash.count({
      where: {
        stateCode: input.stateCode,
      },
    })

    return {
      status: 'ready',
      stateCode: input.stateCode,
      fromYear: input.fromYear,
      toYear: input.toYear,
      limit: input.limit,
      existingCrashCount: existingCount,
      lastRunAt: recentRun?.startedAt?.toISOString() ?? null,
      note: 'Pipeline execution requires running the pipeline CLI. Use: pnpm --filter pipeline ingest --source fars --state <code>',
    }
  },
})

export const fetchArcGIS = createTool({
  id: 'fetchArcGIS',
  description: 'Fetch crash data from state ArcGIS REST services for a given state.',
  inputSchema: z.object({
    stateCode: z.string().length(2).describe('2-letter state code (PA, CO, IL, MA, WA supported)'),
    limit: z.number().int().min(1).max(1000).default(100).describe('Max records to fetch'),
  }),
  execute: async (input) => {
    const supportedStates = ['PA', 'CO', 'IL', 'MA', 'WA']
    if (!supportedStates.includes(input.stateCode.toUpperCase())) {
      return {
        status: 'unsupported',
        stateCode: input.stateCode,
        supportedStates,
        message: `ArcGIS adapter not configured for ${input.stateCode}`,
      }
    }

    const existingCount = await prisma.crash.count({
      where: {
        stateCode: input.stateCode.toUpperCase(),
      },
    })

    return {
      status: 'ready',
      stateCode: input.stateCode,
      limit: input.limit,
      existingCrashCount: existingCount,
      note: 'Pipeline execution requires running the pipeline CLI. Use: pnpm --filter pipeline ingest --source arcgis --state <code>',
    }
  },
})

export const validateBronze = createTool({
  id: 'validateBronze',
  description: 'Check data quality by examining dead letter queue and pipeline run status.',
  inputSchema: z.object({
    stateCode: z.string().length(2).optional().describe('Optional state filter'),
    hours: z.number().int().min(1).max(168).default(24).describe('Look back period in hours'),
  }),
  execute: async (input) => {
    const since = new Date(Date.now() - input.hours * 60 * 60 * 1000)

    const deadLetterCount = await prisma.pipelineDeadLetter.count({
      where: {
        createdAt: { gte: since },
      },
    })

    const recentRuns = await prisma.pipelineRun.findMany({
      where: {
        startedAt: { gte: since },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    })

    const failedRuns = recentRuns.filter((r) => r.status === 'FAILED')

    return {
      deadLetterCount,
      recentRunCount: recentRuns.length,
      failedRunCount: failedRuns.length,
      failedRuns: failedRuns.map((r) => ({
        id: r.id,
        dataSourceId: r.dataSourceId,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        errorLog: r.errorLog,
      })),
      stateCode: input.stateCode ?? 'all',
      lookbackHours: input.hours,
    }
  },
})

export const publishGold = createTool({
  id: 'publishGold',
  description: 'Check gold layer statistics — count of published crashes by state.',
  inputSchema: z.object({
    stateCode: z.string().length(2).optional().describe('Optional state filter'),
  }),
  execute: async (input) => {
    const where = input.stateCode ? { stateCode: input.stateCode } : {}

    const totalCrashes = await prisma.crash.count({ where })
    const withNarratives = await prisma.crashNarrative.count({
      where: input.stateCode ? { crash: { stateCode: input.stateCode } } : {},
    })
    const withEqualizers = await prisma.crashEqualizer.count({
      where: input.stateCode ? { crash: { stateCode: input.stateCode } } : {},
    })

    return {
      stateCode: input.stateCode ?? 'all',
      totalCrashes,
      withNarratives,
      withEqualizers,
      narrativeCoverage: totalCrashes > 0 ? (withNarratives / totalCrashes * 100).toFixed(1) + '%' : 'N/A',
      equalizerCoverage: totalCrashes > 0 ? (withEqualizers / totalCrashes * 100).toFixed(1) + '%' : 'N/A',
    }
  },
})

export const pipelineTools = {
  fetchFARS,
  fetchArcGIS,
  validateBronze,
  publishGold,
}
