import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerAttorneyTools(server: McpServer) {
  registerTool(server,
    'find_attorneys',
    'Find personal injury attorneys by state, city, practice area, and rating',
    {
      stateCode: z.string().length(2).describe('2-letter state code'),
      city: z.string().optional().describe('City name filter'),
      practiceArea: z.string().optional().describe('Practice area filter'),
      minScore: z.number().min(0).max(100).optional().describe('Minimum Attorney Index score'),
      limit: z.number().int().min(1).max(20).default(5).describe('Max results'),
    },
    async (params) => {
      const where: Record<string, unknown> = { stateCode: params.stateCode.toUpperCase() }
      if (params.city) where.city = { contains: params.city, mode: 'insensitive' }
      if (params.practiceArea) where.practiceAreas = { has: params.practiceArea }
      if (params.minScore) where.attorneyIndex = { score: { gte: params.minScore } }

      const attorneys: any[] = await prisma.attorney.findMany({
        where: where as any,
        include: {
          attorneyIndex: { select: { score: true } },
          _count: { select: { reviews: true } },
        },
        take: (params.limit ?? 5) * 2,
      })

      const sorted = attorneys
        .sort((a: any, b: any) => (b.attorneyIndex?.score ?? 0) - (a.attorneyIndex?.score ?? 0))
        .slice(0, params.limit ?? 5)

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            results: sorted.map((a: any) => ({
              id: a.id, slug: a.slug, name: a.name, firmName: a.firmName,
              city: a.city, stateCode: a.stateCode, phone: a.phone, website: a.website,
              practiceAreas: a.practiceAreas, yearsExperience: a.yearsExperience,
              indexScore: a.attorneyIndex?.score ?? null,
              reviewCount: a._count?.reviews ?? 0,
            })),
            total: attorneys.length,
          }),
        }],
      }
    }
  )

  registerTool(server,
    'get_attorney_profile',
    'Get detailed attorney profile with reviews, ratings, and intelligence data',
    {
      attorneyId: z.string().optional().describe('Attorney ID'),
      slug: z.string().optional().describe('Attorney slug'),
    },
    async (params) => {
      if (!params.attorneyId && !params.slug) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide either attorneyId or slug' }) }] }
      }

      const attorney: any = await prisma.attorney.findUnique({
        where: params.attorneyId ? { id: params.attorneyId } : { slug: params.slug! },
        include: {
          attorneyIndex: true,
          reviewIntelligence: true,
          reviews: {
            select: { rating: true, text: true, publishedAt: true },
            orderBy: { publishedAt: 'desc' },
            take: 10,
          },
          _count: { select: { reviews: true } },
        },
      })

      if (!attorney) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Attorney not found' }) }] }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            id: attorney.id, slug: attorney.slug, name: attorney.name,
            firmName: attorney.firmName, phone: attorney.phone, email: attorney.email,
            website: attorney.website, address: attorney.address, city: attorney.city,
            stateCode: attorney.stateCode, zipCode: attorney.zipCode,
            practiceAreas: attorney.practiceAreas, yearsExperience: attorney.yearsExperience,
            index: attorney.attorneyIndex ? {
              score: attorney.attorneyIndex.score,
              communicationScore: attorney.attorneyIndex.communicationScore,
              responsivenessScore: attorney.attorneyIndex.responsivenessScore,
              outcomeScore: attorney.attorneyIndex.outcomeScore,
            } : null,
            reviewIntelligence: attorney.reviewIntelligence ? {
              dimensions: attorney.reviewIntelligence.dimensions,
              sentiment: attorney.reviewIntelligence.sentiment,
              summaryText: attorney.reviewIntelligence.summaryText,
            } : null,
            totalReviews: attorney._count?.reviews ?? 0,
            recentReviews: (attorney.reviews ?? []).map((r: any) => ({
              rating: r.rating,
              text: r.text?.slice(0, 200),
              publishedAt: r.publishedAt?.toISOString().split('T')[0] ?? null,
            })),
          }),
        }],
      }
    }
  )

  registerTool(server,
    'compare_attorneys',
    'Compare two or more attorneys side by side on key metrics',
    {
      attorneyIds: z.array(z.string()).min(2).max(5).describe('Array of attorney IDs to compare'),
    },
    async (params) => {
      const attorneys: any[] = await prisma.attorney.findMany({
        where: { id: { in: params.attorneyIds } },
        include: {
          attorneyIndex: true,
          _count: { select: { reviews: true } },
        },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            comparison: attorneys.map((a: any) => ({
              id: a.id, name: a.name, firmName: a.firmName, city: a.city,
              stateCode: a.stateCode, yearsExperience: a.yearsExperience,
              reviewCount: a._count?.reviews ?? 0,
              index: a.attorneyIndex ? {
                score: a.attorneyIndex.score,
                communicationScore: a.attorneyIndex.communicationScore,
                responsivenessScore: a.attorneyIndex.responsivenessScore,
                outcomeScore: a.attorneyIndex.outcomeScore,
                reviewCountScore: a.attorneyIndex.reviewCountScore,
                specialtyScore: a.attorneyIndex.specialtyScore,
              } : null,
            })),
          }),
        }],
      }
    }
  )
}
