import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerIntersectionTools(server: McpServer) {
  registerTool(server,
    'get_intersection_safety',
    'Get safety analysis for a specific intersection or location with crash history',
    {
      latitude: z.number().min(-90).max(90).describe('Intersection latitude'),
      longitude: z.number().min(-180).max(180).describe('Intersection longitude'),
      radiusMeters: z.number().int().min(50).max(2000).default(200).describe('Search radius in meters'),
    },
    async (params) => {
      const degreeRadius = (params.radiusMeters ?? 200) / 111139

      const crashes = await prisma.crash.findMany({
        where: {
          latitude: { gte: params.latitude - degreeRadius, lte: params.latitude + degreeRadius },
          longitude: { gte: params.longitude - degreeRadius, lte: params.longitude + degreeRadius },
        },
        select: {
          crashSeverity: true,
          mannerOfCollision: true,
          lightCondition: true,
          atmosphericCondition: true,
          crashDate: true,
          intersectionType: true,
        },
      })

      const severityDist: Record<string, number> = {}
      const collisionTypes: Record<string, number> = {}
      let totalInjuries = 0

      for (const c of crashes) {
        const sev = c.crashSeverity || 'UNKNOWN'
        severityDist[sev] = (severityDist[sev] || 0) + 1
        if (c.mannerOfCollision) {
          collisionTypes[c.mannerOfCollision] = (collisionTypes[c.mannerOfCollision] || 0) + 1
        }
        if (sev !== 'PROPERTY_DAMAGE_ONLY') totalInjuries++
      }

      const weights: Record<string, number> = {
        FATAL: 10, SUSPECTED_SERIOUS_INJURY: 5, SUSPECTED_MINOR_INJURY: 2,
        POSSIBLE_INJURY: 1, PROPERTY_DAMAGE_ONLY: 0.5,
      }
      const dangerScore = Object.entries(severityDist).reduce(
        (sum, [sev, count]) => sum + (weights[sev] || 0.5) * count, 0
      )

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            location: { latitude: params.latitude, longitude: params.longitude },
            radiusMeters: params.radiusMeters ?? 200,
            totalCrashes: crashes.length,
            dangerScore: Number(dangerScore.toFixed(1)),
            injuryRate: crashes.length > 0 ? Number((totalInjuries / crashes.length).toFixed(3)) : 0,
            severityDistribution: severityDist,
            topCollisionTypes: Object.entries(collisionTypes)
              .sort(([, a], [, b]) => b - a).slice(0, 5)
              .map(([type, count]) => ({ type, count })),
            dateRange: crashes.length > 0 ? {
              earliest: crashes.map((c) => c.crashDate).sort((a, b) => a.getTime() - b.getTime())[0].toISOString().split('T')[0],
              latest: crashes.map((c) => c.crashDate).sort((a, b) => b.getTime() - a.getTime())[0].toISOString().split('T')[0],
            } : null,
          }),
        }],
      }
    }
  )

  registerTool(server,
    'get_dangerous_intersections',
    'Find the most dangerous intersections in a city or county based on crash density and severity',
    {
      stateCode: z.string().length(2).describe('2-letter state code'),
      county: z.string().optional().describe('County name filter'),
      city: z.string().optional().describe('City name filter'),
      limit: z.number().int().min(1).max(20).default(10).describe('Number of top intersections'),
    },
    async (params) => {
      const where: Record<string, unknown> = {
        stateCode: params.stateCode.toUpperCase(),
        latitude: { not: null },
        longitude: { not: null },
        intersectionType: { not: null },
      }
      if (params.county) where.county = { contains: params.county, mode: 'insensitive' }
      if (params.city) where.cityName = { contains: params.city, mode: 'insensitive' }

      const crashes = await prisma.crash.findMany({
        where: where as any,
        select: {
          latitude: true, longitude: true, crashSeverity: true,
          streetAddress: true, cityName: true, intersectionType: true,
        },
      })

      const GRID_SIZE = 0.001
      const clusters: Record<string, {
        lat: number; lng: number; crashes: number;
        severity: Record<string, number>; streets: Set<string>
      }> = {}

      for (const c of crashes) {
        if (!c.latitude || !c.longitude) continue
        const gridKey = `${Math.round(c.latitude / GRID_SIZE) * GRID_SIZE},${Math.round(c.longitude / GRID_SIZE) * GRID_SIZE}`
        if (!clusters[gridKey]) {
          clusters[gridKey] = {
            lat: Math.round(c.latitude / GRID_SIZE) * GRID_SIZE,
            lng: Math.round(c.longitude / GRID_SIZE) * GRID_SIZE,
            crashes: 0, severity: {}, streets: new Set(),
          }
        }
        clusters[gridKey].crashes++
        const sev = c.crashSeverity || 'UNKNOWN'
        clusters[gridKey].severity[sev] = (clusters[gridKey].severity[sev] || 0) + 1
        if (c.streetAddress) clusters[gridKey].streets.add(c.streetAddress)
      }

      const weights: Record<string, number> = {
        FATAL: 10, SUSPECTED_SERIOUS_INJURY: 5, SUSPECTED_MINOR_INJURY: 2,
        POSSIBLE_INJURY: 1, PROPERTY_DAMAGE_ONLY: 0.5,
      }

      const ranked = Object.values(clusters)
        .map((c) => ({
          latitude: Number(c.lat.toFixed(4)),
          longitude: Number(c.lng.toFixed(4)),
          totalCrashes: c.crashes,
          dangerScore: Number(Object.entries(c.severity)
            .reduce((sum, [sev, count]) => sum + (weights[sev] || 0.5) * count, 0).toFixed(1)),
          severityDistribution: c.severity,
          nearbyStreets: Array.from(c.streets).slice(0, 3),
        }))
        .sort((a, b) => b.dangerScore - a.dangerScore)
        .slice(0, params.limit ?? 10)

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            stateCode: params.stateCode,
            county: params.county ?? null,
            city: params.city ?? null,
            totalCrashesAnalyzed: crashes.length,
            intersections: ranked,
          }),
        }],
      }
    }
  )
}
