import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerCrashTools(server: McpServer) {
  registerTool(server,
    'search_crashes',
    'Search crash records by location, date, severity, and other criteria',
    {
      query: z.string().optional().describe('Free-text search query (searches city, county, street)'),
      stateCode: z.string().length(2).optional().describe('2-letter state code'),
      county: z.string().optional().describe('County name filter'),
      severity: z.string().optional().describe('Crash severity: FATAL, SUSPECTED_SERIOUS_INJURY, etc.'),
      dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
      dateTo: z.string().optional().describe('End date (ISO 8601)'),
      mannerOfCollision: z.string().optional().describe('Collision type: REAR_END, ANGLE, HEAD_ON, etc.'),
      limit: z.number().int().min(1).max(50).default(10).describe('Max results'),
      offset: z.number().int().min(0).default(0).describe('Pagination offset'),
    },
    async (params) => {
      const where: Record<string, unknown> = {}
      if (params.stateCode) where.stateCode = params.stateCode.toUpperCase()
      if (params.county) where.county = { contains: params.county, mode: 'insensitive' }
      if (params.severity) where.crashSeverity = params.severity
      if (params.mannerOfCollision) where.mannerOfCollision = params.mannerOfCollision
      if (params.dateFrom || params.dateTo) {
        where.crashDate = {
          ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
          ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
        }
      }
      if (params.query) {
        where.OR = [
          { cityName: { contains: params.query, mode: 'insensitive' } },
          { county: { contains: params.query, mode: 'insensitive' } },
          { streetAddress: { contains: params.query, mode: 'insensitive' } },
        ]
      }

      const [crashes, total] = await Promise.all([
        prisma.crash.findMany({
          where: where as any,
          select: {
            id: true,
            stateUniqueId: true,
            stateCode: true,
            crashDate: true,
            crashTime: true,
            crashSeverity: true,
            county: true,
            cityName: true,
            streetAddress: true,
            latitude: true,
            longitude: true,
            mannerOfCollision: true,
            _count: { select: { vehicles: true, persons: true } },
          },
          orderBy: { crashDate: 'desc' },
          take: params.limit ?? 10,
          skip: params.offset ?? 0,
        }),
        prisma.crash.count({ where: where as any }),
      ])

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              results: crashes.map((c: any) => ({
                id: c.id,
                stateUniqueId: c.stateUniqueId,
                stateCode: c.stateCode,
                crashDate: c.crashDate.toISOString().split('T')[0],
                crashTime: c.crashTime,
                severity: c.crashSeverity,
                county: c.county,
                city: c.cityName,
                streetAddress: c.streetAddress,
                latitude: c.latitude,
                longitude: c.longitude,
                mannerOfCollision: c.mannerOfCollision,
                vehicleCount: c._count?.vehicles ?? 0,
                personCount: c._count?.persons ?? 0,
              })),
              total,
              limit: params.limit ?? 10,
              offset: params.offset ?? 0,
            }),
          },
        ],
      }
    }
  )

  registerTool(server,
    'get_crash_details',
    'Get complete crash record with vehicles, persons, narrative, and equalizer data',
    {
      crashId: z.string().describe('Crash ID'),
    },
    async (params) => {
      const crash: any = await prisma.crash.findUnique({
        where: { id: params.crashId },
        include: {
          vehicles: { include: { driver: true, persons: true } },
          persons: true,
          narratives: { select: { summary: true, modelTier: true, generatedAt: true }, take: 1 },
          equalizer: {
            select: {
              comparableCohort: true,
              liabilitySignals: true,
              settlementContext: true,
              briefingSections: true,
              confidenceLevel: true,
              generatedAt: true,
            },
          },
        },
      })

      if (!crash) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Crash not found' }) }] }
      }

      const narrative = crash.narratives?.[0] ?? null

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: crash.id,
              stateUniqueId: crash.stateUniqueId,
              stateCode: crash.stateCode,
              crashDate: crash.crashDate.toISOString().split('T')[0],
              crashTime: crash.crashTime,
              severity: crash.crashSeverity,
              county: crash.county,
              city: crash.cityName,
              streetAddress: crash.streetAddress,
              latitude: crash.latitude,
              longitude: crash.longitude,
              mannerOfCollision: crash.mannerOfCollision,
              atmosphericCondition: crash.atmosphericCondition,
              lightCondition: crash.lightCondition,
              intersectionType: crash.intersectionType,
              crashRelatedFactors: crash.crashRelatedFactors,
              vehicles: (crash.vehicles ?? []).map((v: any) => ({
                id: v.id,
                make: v.make,
                model: v.model,
                year: v.modelYear,
                bodyType: v.bodyType,
                totalOccupants: v.totalOccupants,
                contributingCircumstances: v.contributingCircumstances,
                hitAndRun: v.hitAndRun,
                driver: v.driver
                  ? {
                      speedingRelated: v.driver.speedingRelated,
                      distractedBy: v.driver.distractedBy,
                      driverCondition: v.driver.driverCondition,
                      suspectedAlcoholDrug: v.driver.suspectedAlcoholDrug,
                    }
                  : null,
              })),
              persons: (crash.persons ?? []).map((p: any) => ({
                personType: p.personType,
                injuryStatus: p.injuryStatus,
                sex: p.sex,
                seatingPosition: p.seatingPosition,
                restraintUse: p.restraintUse,
                airBagDeployed: p.airBagDeployed,
              })),
              narrative: narrative
                ? {
                    summary: narrative.summary,
                    modelTier: narrative.modelTier,
                    generatedAt: narrative.generatedAt.toISOString(),
                  }
                : null,
              equalizer: crash.equalizer
                ? {
                    confidenceLevel: crash.equalizer.confidenceLevel,
                    comparableCohort: crash.equalizer.comparableCohort,
                    liabilitySignals: crash.equalizer.liabilitySignals,
                    settlementContext: crash.equalizer.settlementContext,
                    briefingSections: crash.equalizer.briefingSections,
                    generatedAt: crash.equalizer.generatedAt.toISOString(),
                  }
                : null,
            }),
          },
        ],
      }
    }
  )

  registerTool(server,
    'get_nearby_crashes',
    'Find crashes near a geographic coordinate within a radius',
    {
      latitude: z.number().min(-90).max(90).describe('Center latitude'),
      longitude: z.number().min(-180).max(180).describe('Center longitude'),
      radiusMiles: z.number().min(0.1).max(50).default(5).describe('Search radius in miles'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max results'),
    },
    async (params) => {
      const radiusMiles = params.radiusMiles ?? 5
      const degreeRadius = radiusMiles / 69

      const crashes = await prisma.crash.findMany({
        where: {
          latitude: { gte: params.latitude - degreeRadius, lte: params.latitude + degreeRadius },
          longitude: { gte: params.longitude - degreeRadius, lte: params.longitude + degreeRadius },
        },
        select: {
          id: true,
          stateCode: true,
          crashDate: true,
          crashSeverity: true,
          county: true,
          cityName: true,
          streetAddress: true,
          latitude: true,
          longitude: true,
          mannerOfCollision: true,
        },
        orderBy: { crashDate: 'desc' },
        take: params.limit ?? 20,
      })

      const withDistance = crashes
        .map((c) => ({
          ...c,
          crashDate: c.crashDate.toISOString().split('T')[0],
          distanceMiles:
            c.latitude && c.longitude
              ? Math.sqrt(
                  Math.pow((c.latitude - params.latitude) * 69, 2) +
                    Math.pow((c.longitude - params.longitude) * 69 * Math.cos((params.latitude * Math.PI) / 180), 2)
                )
              : null,
        }))
        .filter((c) => c.distanceMiles !== null && c.distanceMiles <= radiusMiles)
        .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              results: withDistance.map((c) => ({
                ...c,
                distanceMiles: c.distanceMiles ? Number(c.distanceMiles.toFixed(2)) : null,
              })),
              total: withDistance.length,
              center: { latitude: params.latitude, longitude: params.longitude },
              radiusMiles,
            }),
          },
        ],
      }
    }
  )
}
