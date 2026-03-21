import { tool } from 'ai'
import { z } from 'zod'
import { prisma, Prisma } from '@velora/db'
import { generateEmbedding } from '../vector/embeddings'
import { hybridSearch } from '../vector/qdrant-store'
import { rerankAndEnrich } from '../vector/reranker'

/**
 * AI search tools with real Prisma queries.
 * Used by the AI search endpoint to query crash data, intersection stats,
 * attorney profiles, and trend analysis.
 */

export const searchCrashesTool = tool({
  description:
    'Search crash records with filters. Returns crash summaries with location data for map display.',
  parameters: z.object({
    stateCode: z.string().length(2).optional().describe('2-letter state code filter'),
    city: z.string().optional().describe('City name filter'),
    crashType: z.string().optional().describe('Manner of collision filter'),
    severity: z
      .enum([
        'FATAL',
        'SUSPECTED_SERIOUS_INJURY',
        'SUSPECTED_MINOR_INJURY',
        'POSSIBLE_INJURY',
        'PROPERTY_DAMAGE_ONLY',
      ])
      .optional()
      .describe('Crash severity filter'),
    dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
    dateTo: z.string().optional().describe('End date (ISO 8601)'),
    limit: z.number().int().min(1).max(50).default(10).describe('Max results to return'),
  }),
  execute: async (params) => {
    const where: Prisma.CrashWhereInput = {}

    if (params.stateCode) where.stateCode = params.stateCode.toUpperCase()
    if (params.city) where.cityName = { contains: params.city, mode: 'insensitive' }
    if (params.crashType) {
      where.mannerOfCollision = params.crashType as Prisma.EnumMannerOfCollisionNullableFilter['equals']
    }
    if (params.severity) {
      where.crashSeverity = params.severity as Prisma.EnumCrashSeverityNullableFilter['equals']
    }
    if (params.dateFrom || params.dateTo) {
      where.crashDate = {}
      if (params.dateFrom) where.crashDate.gte = new Date(params.dateFrom)
      if (params.dateTo) where.crashDate.lte = new Date(params.dateTo)
    }

    const [crashes, total] = await Promise.all([
      prisma.crash.findMany({
        where,
        select: {
          id: true,
          crashDate: true,
          stateCode: true,
          cityName: true,
          county: true,
          crashSeverity: true,
          mannerOfCollision: true,
          latitude: true,
          longitude: true,
          streetAddress: true,
          _count: { select: { vehicles: true, persons: true } },
        },
        orderBy: { crashDate: 'desc' },
        take: params.limit,
      }),
      prisma.crash.count({ where }),
    ])

    return {
      results: crashes.map((c) => ({
        id: c.id,
        date: c.crashDate.toISOString().split('T')[0],
        location: [c.streetAddress, c.cityName, c.county, c.stateCode].filter(Boolean).join(', '),
        severity: c.crashSeverity,
        type: c.mannerOfCollision,
        latitude: c.latitude,
        longitude: c.longitude,
        vehicleCount: c._count.vehicles,
        personCount: c._count.persons,
      })),
      total,
      showing: crashes.length,
    }
  },
})

export const getIntersectionStatsTool = tool({
  description:
    'Get crash statistics near a geographic point. Computes danger score, severity distribution, and top crash types.',
  parameters: z.object({
    latitude: z.number().min(-90).max(90).describe('Center latitude'),
    longitude: z.number().min(-180).max(180).describe('Center longitude'),
    radiusMeters: z.number().int().min(50).max(5000).default(500).describe('Search radius in meters'),
  }),
  execute: async (params) => {
    // Convert radius to approximate degrees (1 degree ~= 111,320 meters)
    const radiusDeg = params.radiusMeters / 111320

    const crashes = await prisma.crash.findMany({
      where: {
        latitude: { gte: params.latitude - radiusDeg, lte: params.latitude + radiusDeg },
        longitude: { gte: params.longitude - radiusDeg, lte: params.longitude + radiusDeg },
      },
      select: {
        id: true,
        crashSeverity: true,
        mannerOfCollision: true,
        crashDate: true,
        streetAddress: true,
        cityName: true,
      },
    })

    // Severity distribution
    const severityDist: Record<string, number> = {}
    for (const c of crashes) {
      const sev = c.crashSeverity ?? 'UNKNOWN'
      severityDist[sev] = (severityDist[sev] ?? 0) + 1
    }

    // Top crash types
    const typeCounts: Record<string, number> = {}
    for (const c of crashes) {
      const t = c.mannerOfCollision ?? 'UNKNOWN'
      typeCounts[t] = (typeCounts[t] ?? 0) + 1
    }
    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))

    // Danger score: 0-100 based on crash density + severity weighting
    const severityWeights: Record<string, number> = {
      FATAL: 10,
      SUSPECTED_SERIOUS_INJURY: 7,
      SUSPECTED_MINOR_INJURY: 4,
      POSSIBLE_INJURY: 2,
      PROPERTY_DAMAGE_ONLY: 1,
      UNKNOWN: 1,
    }
    const weightedSum = crashes.reduce((sum, c) => {
      return sum + (severityWeights[c.crashSeverity ?? 'UNKNOWN'] ?? 1)
    }, 0)
    // Normalize: 50 weighted crashes in radius = score 100
    const dangerScore = Math.min(100, Math.round((weightedSum / 50) * 100))

    // Guess intersection name from most common address
    const addressCounts: Record<string, number> = {}
    for (const c of crashes) {
      const addr = c.streetAddress ?? c.cityName ?? 'Unknown'
      addressCounts[addr] = (addressCounts[addr] ?? 0) + 1
    }
    const intersectionName =
      Object.entries(addressCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown Location'

    return {
      intersectionName,
      latitude: params.latitude,
      longitude: params.longitude,
      radiusMeters: params.radiusMeters,
      totalCrashes: crashes.length,
      severityDistribution: severityDist,
      topCrashTypes: topTypes,
      dangerScore,
      dateRange: crashes.length > 0
        ? {
            earliest: crashes
              .map((c) => c.crashDate)
              .sort((a, b) => a.getTime() - b.getTime())[0]
              ?.toISOString()
              .split('T')[0],
            latest: crashes
              .map((c) => c.crashDate)
              .sort((a, b) => b.getTime() - a.getTime())[0]
              ?.toISOString()
              .split('T')[0],
          }
        : null,
    }
  },
})

export const findAttorneysTool = tool({
  description:
    'Find attorneys by location and specialty, sorted by Attorney Index score. Returns profiles with review scores.',
  parameters: z.object({
    stateCode: z.string().length(2).describe('2-letter state code'),
    city: z.string().optional().describe('City name filter'),
    specialty: z.string().optional().describe('Practice area filter (e.g., "personal injury")'),
    limit: z.number().int().min(1).max(20).default(5).describe('Max results'),
  }),
  execute: async (params) => {
    const where: Prisma.AttorneyWhereInput = {
      stateCode: params.stateCode.toUpperCase(),
    }

    if (params.city) where.city = { contains: params.city, mode: 'insensitive' }
    if (params.specialty) where.practiceAreas = { has: params.specialty }

    const attorneys = await prisma.attorney.findMany({
      where,
      include: {
        attorneyIndex: true,
        reviewIntelligence: {
          select: {
            communication: true,
            outcome: true,
            responsiveness: true,
            empathy: true,
            expertise: true,
            satisfaction: true,
            reviewCount: true,
            trend: true,
            bestQuotes: true,
          },
        },
      },
      orderBy: { attorneyIndex: { score: 'desc' } },
      take: params.limit,
    })

    return {
      attorneys: attorneys.map((a) => ({
        id: a.id,
        name: a.name,
        firmName: a.firmName,
        city: a.city,
        stateCode: a.stateCode,
        practiceAreas: a.practiceAreas,
        yearsExperience: a.yearsExperience,
        website: a.website,
        indexScore: a.attorneyIndex?.score ?? null,
        reviewCount: a.reviewIntelligence?.reviewCount ?? 0,
        dimensions: a.reviewIntelligence
          ? {
              communication: a.reviewIntelligence.communication,
              outcome: a.reviewIntelligence.outcome,
              responsiveness: a.reviewIntelligence.responsiveness,
              empathy: a.reviewIntelligence.empathy,
              expertise: a.reviewIntelligence.expertise,
              satisfaction: a.reviewIntelligence.satisfaction,
            }
          : null,
        trend: a.reviewIntelligence?.trend ?? null,
      })),
      total: attorneys.length,
    }
  },
})

export const getTrendsTool = tool({
  description:
    'Aggregate crash data by time period for trend analysis. Returns time series data for charts.',
  parameters: z.object({
    stateCode: z.string().length(2).optional().describe('2-letter state code filter'),
    county: z.string().optional().describe('County name filter'),
    period: z
      .enum(['month', 'year', 'dayOfWeek', 'hourOfDay'])
      .default('month')
      .describe('Aggregation period'),
    dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
    dateTo: z.string().optional().describe('End date (ISO 8601)'),
  }),
  execute: async (params) => {
    const where: Prisma.CrashWhereInput = {}
    if (params.stateCode) where.stateCode = params.stateCode.toUpperCase()
    if (params.county) where.county = { contains: params.county, mode: 'insensitive' }
    if (params.dateFrom || params.dateTo) {
      where.crashDate = {}
      if (params.dateFrom) where.crashDate.gte = new Date(params.dateFrom)
      if (params.dateTo) where.crashDate.lte = new Date(params.dateTo)
    }

    // Fetch crashes with minimal data for aggregation
    const crashes = await prisma.crash.findMany({
      where,
      select: {
        crashDate: true,
        crashTime: true,
        crashSeverity: true,
      },
      orderBy: { crashDate: 'asc' },
    })

    type DataPoint = { label: string; total: number; fatal: number; injury: number; propertyOnly: number }
    const buckets = new Map<string, DataPoint>()

    for (const c of crashes) {
      let label: string
      const d = c.crashDate

      switch (params.period) {
        case 'month':
          label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          break
        case 'year':
          label = `${d.getFullYear()}`
          break
        case 'dayOfWeek': {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          label = days[d.getDay()] ?? 'Unknown'
          break
        }
        case 'hourOfDay': {
          if (c.crashTime) {
            const hour = parseInt(c.crashTime.split(':')[0] ?? '0', 10)
            label = `${String(hour).padStart(2, '0')}:00`
          } else {
            label = 'Unknown'
          }
          break
        }
      }

      const existing = buckets.get(label) ?? { label, total: 0, fatal: 0, injury: 0, propertyOnly: 0 }
      existing.total++
      if (c.crashSeverity === 'FATAL') existing.fatal++
      else if (
        c.crashSeverity === 'SUSPECTED_SERIOUS_INJURY' ||
        c.crashSeverity === 'SUSPECTED_MINOR_INJURY' ||
        c.crashSeverity === 'POSSIBLE_INJURY'
      )
        existing.injury++
      else if (c.crashSeverity === 'PROPERTY_DAMAGE_ONLY') existing.propertyOnly++
      buckets.set(label, existing)
    }

    const dataPoints = Array.from(buckets.values())

    // Sort appropriately
    if (params.period === 'dayOfWeek') {
      const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      dataPoints.sort((a, b) => dayOrder.indexOf(a.label) - dayOrder.indexOf(b.label))
    } else if (params.period === 'hourOfDay') {
      dataPoints.sort((a, b) => a.label.localeCompare(b.label))
    }
    // month and year are already sorted by query order

    return {
      period: params.period,
      totalRecords: crashes.length,
      dataPoints,
    }
  },
})

// ============================================================
// HYBRID RAG TOOLS — Semantic search + metadata enrichment
// ============================================================

export const searchReviewsTool = tool({
  description:
    'Semantic search over 800K+ attorney reviews. Find reviews about specific topics like communication quality, case outcomes, fee transparency, trial experience. Returns attorneys ranked by composite score (vector similarity + attorney index + recency + review volume) with matched review snippets.',
  parameters: z.object({
    query: z.string().describe('What to search for in reviews (e.g., "excellent communication", "won my personal injury case", "transparent about fees")'),
    stateCode: z.string().length(2).optional().describe('2-letter state code filter'),
    city: z.string().optional().describe('City name filter'),
    attorneyId: z.string().optional().describe('Specific attorney ID to search within'),
    practiceArea: z.string().optional().describe('Practice area filter'),
    minRating: z.number().min(1).max(5).optional().describe('Minimum star rating'),
    limit: z.number().int().min(1).max(20).default(10).describe('Max attorneys to return'),
  }),
  execute: async (params) => {
    try {
      // 1. Generate query embedding
      const queryVector = await generateEmbedding(params.query)

      // 2. Hybrid search: vector + metadata filters
      const vectorHits = await hybridSearch({
        queryVector,
        filters: {
          stateCode: params.stateCode?.toUpperCase(),
          city: params.city,
          attorneyId: params.attorneyId,
          practiceArea: params.practiceArea,
          minRating: params.minRating,
        },
        limit: params.limit * 5, // fetch more for re-ranking diversity
        minScore: 0.3,
      })

      if (vectorHits.length === 0) {
        return { attorneys: [], total: 0, query: params.query, message: 'No matching reviews found.' }
      }

      // 3. Re-rank with attorney metadata enrichment
      const ranked = await rerankAndEnrich(vectorHits, { maxAttorneys: params.limit })

      return {
        attorneys: ranked.map(r => ({
          ...r.attorney,
          compositeScore: r.compositeScore,
          scoreBreakdown: r.scoreBreakdown,
          matchedReviews: r.relevantReviews,
        })),
        total: ranked.length,
        query: params.query,
      }
    } catch (err) {
      // Graceful fallback if vector search unavailable
      const msg = err instanceof Error ? err.message : 'Vector search unavailable'
      return { attorneys: [], total: 0, query: params.query, error: msg }
    }
  },
})

export const getAttorneyProfileTool = tool({
  description:
    'Get detailed profile for a specific attorney including review intelligence dimensions (communication, outcome, responsiveness, fee transparency), best review quotes, trend direction, recent reviews, and Attorney Index score. Use after searchReviews or findAttorneys to drill into a specific attorney.',
  parameters: z.object({
    attorneyId: z.string().optional().describe('Attorney ID'),
    slug: z.string().optional().describe('Attorney URL slug'),
  }),
  execute: async (params) => {
    const where: Prisma.AttorneyWhereInput = {}
    if (params.attorneyId) where.id = params.attorneyId
    else if (params.slug) where.slug = params.slug
    else return { error: 'Provide either attorneyId or slug' }

    const attorney = await prisma.attorney.findFirst({
      where,
      include: {
        attorneyIndex: true,
        reviewIntelligence: true,
        reviews: {
          select: {
            id: true,
            text: true,
            rating: true,
            authorName: true,
            publishedAt: true,
          },
          where: { text: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true } },
      },
    })

    if (!attorney) return { error: 'Attorney not found' }

    const ri = attorney.reviewIntelligence

    return {
      id: attorney.id,
      name: attorney.name,
      slug: attorney.slug,
      firmName: attorney.firmName,
      city: attorney.city,
      stateCode: attorney.stateCode,
      practiceAreas: attorney.practiceAreas,
      yearsExperience: attorney.yearsExperience,
      website: attorney.website,
      phone: attorney.phone,
      googleRating: attorney.googleRating,
      totalReviews: attorney._count.reviews,
      indexScore: attorney.attorneyIndex?.score ?? null,
      dataQuality: attorney.attorneyIndex?.dataQuality ?? null,
      dimensions: ri ? {
        communication: ri.communication,
        outcome: ri.outcome,
        responsiveness: ri.responsiveness,
        feeTransparency: ri.feeTransparency,
        empathy: ri.empathy,
        expertise: ri.expertise,
      } : null,
      trend: ri?.trend ?? null,
      bestQuotes: ri?.bestQuotes ?? null,
      recentReviews: attorney.reviews.map(r => ({
        text: r.text?.slice(0, 300),
        rating: r.rating,
        author: r.authorName,
        date: r.publishedAt?.toISOString().split('T')[0],
      })),
    }
  },
})

export const findNearbyAttorneysTool = tool({
  description:
    'Find attorneys near a geographic point (e.g., near a crash site). Returns attorneys within a radius sorted by a blend of distance and Attorney Index score. Use after getting crash location from searchCrashes or getIntersectionStats.',
  parameters: z.object({
    latitude: z.number().min(-90).max(90).describe('Center latitude'),
    longitude: z.number().min(-180).max(180).describe('Center longitude'),
    radiusMiles: z.number().min(1).max(100).default(25).describe('Search radius in miles'),
    practiceArea: z.string().optional().describe('Practice area filter'),
    limit: z.number().int().min(1).max(20).default(5).describe('Max results'),
  }),
  execute: async (params) => {
    // Convert miles to approximate degrees (1 degree ~= 69 miles)
    const radiusDeg = params.radiusMiles / 69

    const where: Prisma.AttorneyWhereInput = {
      latitude: { gte: params.latitude - radiusDeg, lte: params.latitude + radiusDeg },
      longitude: { gte: params.longitude - radiusDeg, lte: params.longitude + radiusDeg },
    }
    if (params.practiceArea) where.practiceAreas = { has: params.practiceArea }

    const attorneys = await prisma.attorney.findMany({
      where,
      include: {
        attorneyIndex: true,
        reviewIntelligence: {
          select: {
            communication: true,
            outcome: true,
            responsiveness: true,
            feeTransparency: true,
            trend: true,
            bestQuotes: true,
            reviewCount: true,
          },
        },
        _count: { select: { reviews: true } },
      },
      take: 100, // fetch more, we'll sort and limit after distance calc
    })

    // Calculate Haversine distance and sort
    const toRad = (d: number) => (d * Math.PI) / 180
    const results = attorneys
      .map(a => {
        if (!a.latitude || !a.longitude) return null
        const dLat = toRad(a.latitude - params.latitude)
        const dLon = toRad(a.longitude - params.longitude)
        const sin2 = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(params.latitude)) * Math.cos(toRad(a.latitude)) * Math.sin(dLon / 2) ** 2
        const distMiles = 3959 * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2))

        if (distMiles > params.radiusMiles) return null

        const ri = a.reviewIntelligence
        // Blend: 60% index score, 40% proximity (closer = better)
        const proximityScore = Math.max(0, 100 * (1 - distMiles / params.radiusMiles))
        const idxScore = a.attorneyIndex?.score ?? 50
        const blendedScore = Math.round(idxScore * 0.6 + proximityScore * 0.4)

        return {
          id: a.id,
          name: a.name,
          slug: a.slug,
          firmName: a.firmName,
          city: a.city,
          stateCode: a.stateCode,
          practiceAreas: a.practiceAreas,
          distanceMiles: Math.round(distMiles * 10) / 10,
          indexScore: a.attorneyIndex?.score ?? null,
          blendedScore,
          dimensions: ri ? {
            communication: ri.communication,
            outcome: ri.outcome,
            responsiveness: ri.responsiveness,
            feeTransparency: ri.feeTransparency,
          } : null,
          trend: ri?.trend ?? null,
          reviewCount: ri?.reviewCount ?? a._count.reviews,
          bestQuotes: ri?.bestQuotes ?? null,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.blendedScore - a!.blendedScore)
      .slice(0, params.limit)

    return {
      attorneys: results,
      total: results.length,
      searchCenter: { latitude: params.latitude, longitude: params.longitude },
      radiusMiles: params.radiusMiles,
    }
  },
})

// Re-export parameter schemas for backward compatibility
export const searchCrashesParameters = searchCrashesTool.parameters
export const getIntersectionStatsParameters = getIntersectionStatsTool.parameters
export const findAttorneysParameters = findAttorneysTool.parameters
export const getTrendsParameters = getTrendsTool.parameters

// Re-export execute functions for backward compatibility
export async function searchCrashes(params: z.infer<typeof searchCrashesParameters>) {
  return searchCrashesTool.execute!(params, { toolCallId: 'direct', messages: [] })
}

export async function getIntersectionStats(params: z.infer<typeof getIntersectionStatsParameters>) {
  return getIntersectionStatsTool.execute!(params, { toolCallId: 'direct', messages: [] })
}

export async function findAttorneys(params: z.infer<typeof findAttorneysParameters>) {
  return findAttorneysTool.execute!(params, { toolCallId: 'direct', messages: [] })
}

export async function getTrends(params: z.infer<typeof getTrendsParameters>) {
  return getTrendsTool.execute!(params, { toolCallId: 'direct', messages: [] })
}
