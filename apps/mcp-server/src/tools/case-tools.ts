import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerCaseTools(server: McpServer) {
  // ─── get_case_summary ─────────────────────────────────
  registerTool(server,
    'get_case_summary',
    'Get a summary of a personal injury case matter including stats, linked crash, attorney, and key metrics',
    {
      matterId: z.string().describe('The matter/case ID'),
    },
    async (params) => {
      const matter = await prisma.matter.findUnique({
        where: { id: params.matterId },
        include: {
          _count: {
            select: { episodes: true, entities: true, facts: true, timelineEvents: true, confirmations: true },
          },
          crash: {
            select: { id: true, crashDate: true, stateCode: true, crashSeverity: true, cityName: true, county: true },
          },
          attorney: {
            select: { name: true, firmName: true, phone: true, slug: true },
          },
        },
      })

      if (!matter) {
        return { content: [{ type: 'text' as const, text: 'Matter not found' }] }
      }

      const daysToDeadline = matter.statuteDeadline
        ? Math.round((matter.statuteDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            id: matter.id,
            clientName: matter.clientName,
            status: matter.status,
            accidentDate: matter.accidentDate,
            stateCode: matter.stateCode,
            statuteDeadline: matter.statuteDeadline,
            daysToDeadline,
            lastActivity: matter.lastActivityAt,
            crash: matter.crash,
            attorney: matter.attorney,
            counts: matter._count,
          }, null, 2),
        }],
      }
    }
  )

  // ─── get_case_timeline ────────────────────────────────
  registerTool(server,
    'get_case_timeline',
    'Get the timeline of events for a case, filterable by category and date range',
    {
      matterId: z.string().describe('The matter/case ID'),
      category: z.string().optional().describe('Filter by category: medical, legal, communication, financial, milestone'),
      dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
      dateTo: z.string().optional().describe('End date (ISO 8601)'),
      limit: z.number().int().min(1).max(100).default(25).describe('Max results'),
    },
    async (params) => {
      const where: Record<string, unknown> = { matterId: params.matterId }
      if (params.category) where.category = params.category
      if (params.dateFrom || params.dateTo) {
        where.occurredAt = {
          ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
          ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
        }
      }

      const events = await prisma.caseTimeline.findMany({
        where: where as any,
        orderBy: { occurredAt: 'desc' },
        take: params.limit,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ events, total: events.length }, null, 2),
        }],
      }
    }
  )

  // ─── get_case_entities ────────────────────────────────
  registerTool(server,
    'get_case_entities',
    'Get extracted entities for a case (people, facilities, injuries, medications, etc.)',
    {
      matterId: z.string().describe('The matter/case ID'),
      type: z.string().optional().describe('Entity type filter: PERSON, FACILITY, INJURY, MEDICATION, etc.'),
    },
    async (params) => {
      const where: Record<string, unknown> = { matterId: params.matterId }
      if (params.type) where.type = params.type

      const entities = await prisma.caseEntity.findMany({
        where,
        orderBy: { confidence: 'desc' },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ entities, total: entities.length }, null, 2),
        }],
      }
    }
  )

  // ─── get_active_facts ─────────────────────────────────
  registerTool(server,
    'get_active_facts',
    'Get currently active temporal facts for a case (what is known to be true right now)',
    {
      matterId: z.string().describe('The matter/case ID'),
      predicate: z.string().optional().describe('Filter by predicate: treating_at, diagnosed_with, insured_by, etc.'),
    },
    async (params) => {
      const now = new Date()
      const where: Record<string, unknown> = {
        matterId: params.matterId,
        status: { in: ['CONFIRMED', 'CANDIDATE'] },
        validFrom: { lte: now },
        OR: [
          { validUntil: null },
          { validUntil: { gt: now } },
        ],
      }
      if (params.predicate) where.predicate = params.predicate

      const facts = await prisma.caseFact.findMany({
        where: where as any,
        orderBy: { validFrom: 'desc' },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ facts, total: facts.length }, null, 2),
        }],
      }
    }
  )

  // ─── get_treatment_gaps ───────────────────────────────
  registerTool(server,
    'get_treatment_gaps',
    'Detect treatment gaps in a case that could weaken the claim',
    {
      matterId: z.string().describe('The matter/case ID'),
    },
    async (params) => {
      const gaps = await prisma.caseTimeline.findMany({
        where: {
          matterId: params.matterId,
          isGap: true,
        },
        orderBy: { occurredAt: 'asc' },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            gaps,
            totalGaps: gaps.length,
            hasGaps: gaps.length > 0,
            totalGapDays: gaps.reduce((sum, g) => sum + (g.gapDays || 0), 0),
          }, null, 2),
        }],
      }
    }
  )

  // ─── search_case_episodes ─────────────────────────────
  registerTool(server,
    'search_case_episodes',
    'Search episodes (events, calls, notes, visits) in a case by keyword',
    {
      matterId: z.string().describe('The matter/case ID'),
      query: z.string().describe('Search query'),
      type: z.string().optional().describe('Episode type filter: CALL_TRANSCRIPT, VOICE_NOTE, LOCATION_VISIT, etc.'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
    },
    async (params) => {
      const where: Record<string, unknown> = {
        matterId: params.matterId,
        textContent: { contains: params.query, mode: 'insensitive' },
      }
      if (params.type) where.type = params.type

      const episodes = await prisma.episode.findMany({
        where: where as any,
        orderBy: { occurredAt: 'desc' },
        take: params.limit,
        select: {
          id: true,
          type: true,
          title: true,
          textContent: true,
          occurredAt: true,
          locationName: true,
          duration: true,
        },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ episodes, total: episodes.length }, null, 2),
        }],
      }
    }
  )

  // ─── get_knowledge_graph ──────────────────────────────
  registerTool(server,
    'get_knowledge_graph',
    'Get the knowledge graph for a case showing entities as nodes and facts as edges. Useful for understanding relationships between people, providers, injuries, and other case elements.',
    {
      matterId: z.string().describe('The matter/case ID'),
      includeEpisodes: z.boolean().optional().default(false).describe('Include episode nodes in the graph'),
    },
    async (params) => {
      const entities = await prisma.caseEntity.findMany({
        where: { matterId: params.matterId },
        select: { id: true, type: true, name: true, confidence: true },
      })

      const facts = await prisma.caseFact.findMany({
        where: {
          matterId: params.matterId,
          status: { in: ['CONFIRMED', 'CANDIDATE'] },
        },
        select: {
          id: true,
          subject: true,
          predicate: true,
          object: true,
          confidence: true,
          status: true,
          validFrom: true,
          validUntil: true,
        },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            entities: entities.map(e => ({
              type: e.type,
              name: e.name,
              confidence: Math.round(e.confidence * 100) + '%',
            })),
            relationships: facts.map(f => ({
              from: f.subject,
              relation: f.predicate.replace(/_/g, ' '),
              to: f.object,
              confidence: Math.round(f.confidence * 100) + '%',
              status: f.status,
              since: f.validFrom,
              until: f.validUntil,
            })),
            summary: {
              totalEntities: entities.length,
              totalRelationships: facts.length,
              entityTypes: Object.fromEntries(
                Object.entries(
                  entities.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type as keyof typeof acc] || 0) + 1 }), {} as Record<string, number>)
                )
              ),
            },
          }, null, 2),
        }],
      }
    }
  )
}
