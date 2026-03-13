import { z } from 'zod'

/**
 * Tool definitions for AI search capabilities.
 * Implementations are stubs returning mock data - will be connected to real data in Phase 2.
 */

export const searchCrashesParameters = z.object({
  query: z.string().describe('Natural language search query'),
  stateCode: z.string().length(2).optional().describe('2-letter state code filter'),
  dateFrom: z.string().optional().describe('Start date (ISO 8601)'),
  dateTo: z.string().optional().describe('End date (ISO 8601)'),
  severity: z.string().optional().describe('Crash severity filter'),
  limit: z.number().int().min(1).max(50).default(10).describe('Max results to return'),
})

export const getIntersectionStatsParameters = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(50).max(5000).default(500),
})

export const findAttorneysParameters = z.object({
  stateCode: z.string().length(2),
  city: z.string().optional(),
  practiceArea: z.string().optional(),
  minScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(20).default(5),
})

export const getTrendsParameters = z.object({
  stateCode: z.string().length(2),
  county: z.string().optional(),
  metric: z.enum(['total_crashes', 'fatalities', 'injuries', 'severity_distribution']),
  period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  months: z.number().int().min(1).max(60).default(12),
})

// Stub implementations returning mock data

export async function searchCrashes(_params: z.infer<typeof searchCrashesParameters>) {
  return {
    results: [],
    total: 0,
    message: 'Search not yet implemented - pending Phase 2',
  }
}

export async function getIntersectionStats(_params: z.infer<typeof getIntersectionStatsParameters>) {
  return {
    intersectionName: 'Unknown',
    totalCrashes: 0,
    dangerScore: 0,
    message: 'Intersection stats not yet implemented - pending Phase 2',
  }
}

export async function findAttorneys(_params: z.infer<typeof findAttorneysParameters>) {
  return {
    attorneys: [],
    total: 0,
    message: 'Attorney search not yet implemented - pending Phase 1',
  }
}

export async function getTrends(_params: z.infer<typeof getTrendsParameters>) {
  return {
    dataPoints: [],
    message: 'Trend analysis not yet implemented - pending Phase 2',
  }
}
