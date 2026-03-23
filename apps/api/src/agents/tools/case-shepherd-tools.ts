import { createTool } from '@mastra/core/tools'
import type { CoreTool } from '@mastra/core/tools'
import { makeCoreTool } from '@mastra/core/utils'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { getActiveFacts } from '../../services/case/fact-manager'
import { detectGaps } from '../../services/case/gap-detector'
import { ingestEpisode } from '../../services/case/episode-ingest'
import { EpisodeType } from '@velora/shared'
import { processEpisodeExtraction } from '../../services/case/entity-extractor'
import { createConfirmation } from '../../services/case/confirmation'

export const getMatterSummaryTool = createTool({
  id: 'getMatterSummary',
  description: 'Get a summary of the current case including key stats',
  inputSchema: z.object({
    matterId: z.string(),
  }),
  execute: async ({ matterId }) => {
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      include: {
        _count: {
          select: { episodes: true, entities: true, facts: true, timelineEvents: true },
        },
        crash: { select: { id: true, crashDate: true, stateCode: true, crashSeverity: true, cityName: true } },
        attorney: { select: { name: true, firmName: true, phone: true } },
      },
    })
    if (!matter) return { error: 'Matter not found' }
    return {
      id: matter.id,
      clientName: matter.clientName,
      status: matter.status,
      accidentDate: matter.accidentDate,
      stateCode: matter.stateCode,
      statuteDeadline: matter.statuteDeadline,
      lastActivity: matter.lastActivityAt,
      crash: matter.crash,
      attorney: matter.attorney,
      counts: matter._count,
    }
  },
})

export const getActiveFactsTool = createTool({
  id: 'getActiveFacts',
  description: 'Get currently active facts for the case',
  inputSchema: z.object({
    matterId: z.string(),
    predicate: z.string().optional(),
  }),
  execute: async ({ matterId, predicate }) => {
    const facts = await getActiveFacts(matterId, { predicate: predicate || undefined })
    return { facts: facts.slice(0, 20) }
  },
})

export const getTimelineTool = createTool({
  id: 'getTimeline',
  description: 'Get recent timeline events for the case',
  inputSchema: z.object({
    matterId: z.string(),
    category: z.string().optional(),
  }),
  execute: async ({ matterId, category }) => {
    const where: Record<string, unknown> = { matterId }
    if (category) where.category = category

    const events = await prisma.caseTimeline.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 15,
    })
    return { events }
  },
})

export const detectGapsTool = createTool({
  id: 'detectGaps',
  description: 'Check for treatment gaps that could weaken the case',
  inputSchema: z.object({
    matterId: z.string(),
  }),
  execute: async ({ matterId }) => {
    const gaps = await detectGaps(matterId)
    return { gaps, hasGaps: gaps.length > 0 }
  },
})

export const ingestChatEpisodeTool = createTool({
  id: 'ingestChatEpisode',
  description: 'Save a chat message as a case episode',
  inputSchema: z.object({
    matterId: z.string(),
    message: z.string(),
    role: z.enum(['user', 'assistant']),
  }),
  execute: async ({ matterId, message, role }) => {
    const episode = await ingestEpisode(matterId, {
      type: EpisodeType.CHAT_MESSAGE,
      textContent: message,
      title: message.length > 60 ? message.slice(0, 60) + '...' : message,
      occurredAt: new Date().toISOString(),
      metadata: { role },
    })
    return { episodeId: episode.id }
  },
})

export const extractAndUpdateTool = createTool({
  id: 'extractAndUpdate',
  description: 'Run entity extraction on text and update case entities/facts',
  inputSchema: z.object({
    episodeId: z.string(),
  }),
  execute: async ({ episodeId }) => {
    await processEpisodeExtraction(episodeId)
    return { success: true }
  },
})

export const createConfirmationTool = createTool({
  id: 'createConfirmation',
  description: 'Ask the user a yes/no question to confirm something about their case',
  inputSchema: z.object({
    matterId: z.string(),
    prompt: z.string().describe('The yes/no question to ask'),
    factId: z.string().optional(),
    entityId: z.string().optional(),
  }),
  execute: async ({ matterId, prompt, factId, entityId }) => {
    const confirmation = await createConfirmation(matterId, {
      prompt,
      factId: factId || undefined,
      entityId: entityId || undefined,
    })
    return { confirmationId: confirmation.id }
  },
})

export const caseShepherdTools = {
  getMatterSummary: getMatterSummaryTool,
  getActiveFacts: getActiveFactsTool,
  getTimeline: getTimelineTool,
  detectGaps: detectGapsTool,
  ingestChatEpisode: ingestChatEpisodeTool,
  extractAndUpdate: extractAndUpdateTool,
  createConfirmation: createConfirmationTool,
}

export const caseShepherdAiTools = Object.fromEntries(
  Object.entries(caseShepherdTools).map(([name, tool]) => [
    name,
    makeCoreTool(tool, { name, requestContext: {} as never }, 'toolset'),
  ])
) as Record<keyof typeof caseShepherdTools, CoreTool>
