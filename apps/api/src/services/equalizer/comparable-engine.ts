import { prisma, PrismaClient } from '@velora/db'

export interface ComparableCohort {
  count: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' // HIGH: 50+, MEDIUM: 20-49, LOW: <20
  severityDistribution: Record<string, number>
  avgVehicles: number
  injuryRate: number
  fatalityRate: number
  topContributingFactors: string[]
  dateRange: { earliest: Date; latest: Date }
}

// 7 similarity dimensions
export const SIMILARITY_DIMENSIONS = [
  'mannerOfCollision', // Exact match
  'crashSeverity', // Exact match
  'vehicleCount', // +/-1 tolerance (count vehicles relation)
  'atmosphericCondition', // Exact match
  'lightCondition', // Group: day (DAYLIGHT/DAWN/DUSK) vs night
  'intersectionType', // Exact match or null
  'stateCode', // Same state, expand to nationwide if cohort < 20
] as const

export type SimilarityDimension = (typeof SIMILARITY_DIMENSIONS)[number]

export const MIN_MATCHING_DIMENSIONS = 4
const MIN_COHORT_SIZE = 20

const DAY_LIGHTS = ['DAYLIGHT', 'DAWN', 'DUSK']
const NIGHT_LIGHTS = ['DARK_LIGHTED', 'DARK_NOT_LIGHTED', 'DARK_UNKNOWN_LIGHTING']

export interface CrashWithRelations {
  id: string
  mannerOfCollision: string | null
  crashSeverity: string | null
  atmosphericCondition: string | null
  lightCondition: string | null
  intersectionType: string | null
  stateCode: string
  crashRelatedFactors: string[]
  vehicles: { id: string }[]
  persons: { injuryStatus: string | null; personType: string }[]
  crashDate: Date
}

export interface FindComparableOptions {
  prisma: PrismaClient
  excludeCrashId?: string
  maxResults?: number
}

function getLightGroup(lightCondition: string | null): 'day' | 'night' | null {
  if (!lightCondition) return null
  if (DAY_LIGHTS.includes(lightCondition)) return 'day'
  if (NIGHT_LIGHTS.includes(lightCondition)) return 'night'
  return null
}

function buildDimensionFilters(
  crash: CrashWithRelations,
  includeStateFilter: boolean
): { filters: Record<string, unknown>[]; dimensionNames: string[] }[] {
  const dimensions: { filter: Record<string, unknown>; name: string }[] = []

  if (crash.mannerOfCollision) {
    dimensions.push({
      name: 'mannerOfCollision',
      filter: { mannerOfCollision: crash.mannerOfCollision },
    })
  }

  if (crash.crashSeverity) {
    dimensions.push({
      name: 'crashSeverity',
      filter: { crashSeverity: crash.crashSeverity },
    })
  }

  // vehicleCount: crashes with vehicle count +/-1
  const vehicleCount = crash.vehicles.length
  dimensions.push({
    name: 'vehicleCount',
    filter: {
      vehicles: {
        some: {},
      },
    },
  })

  if (crash.atmosphericCondition) {
    dimensions.push({
      name: 'atmosphericCondition',
      filter: { atmosphericCondition: crash.atmosphericCondition },
    })
  }

  // Light condition grouping
  const lightGroup = getLightGroup(crash.lightCondition)
  if (lightGroup) {
    const lightValues = lightGroup === 'day' ? DAY_LIGHTS : NIGHT_LIGHTS
    dimensions.push({
      name: 'lightCondition',
      filter: { lightCondition: { in: lightValues } },
    })
  }

  if (crash.intersectionType) {
    dimensions.push({
      name: 'intersectionType',
      filter: { intersectionType: crash.intersectionType },
    })
  }

  if (includeStateFilter) {
    dimensions.push({
      name: 'stateCode',
      filter: { stateCode: crash.stateCode },
    })
  }

  // Generate combinations of MIN_MATCHING_DIMENSIONS or more
  const combos = getCombinations(dimensions, MIN_MATCHING_DIMENSIONS)
  return combos.map((combo) => ({
    filters: combo.map((d) => d.filter),
    dimensionNames: combo.map((d) => d.name),
  }))
}

function getCombinations<T>(arr: T[], minSize: number): T[][] {
  const results: T[][] = []
  const n = arr.length

  function backtrack(start: number, current: T[]) {
    if (current.length >= minSize) {
      results.push([...current])
    }
    if (current.length >= n) return
    for (let i = start; i < n; i++) {
      current.push(arr[i])
      backtrack(i + 1, current)
      current.pop()
    }
  }

  backtrack(0, [])
  // Sort by most dimensions first
  results.sort((a, b) => b.length - a.length)
  return results
}

export async function findComparableCrashes(
  crash: CrashWithRelations,
  options: FindComparableOptions
): Promise<ComparableCohort> {
  const { prisma, excludeCrashId, maxResults = 500 } = options

  // Try same-state first, then nationwide
  for (const includeStateFilter of [true, false]) {
    const combos = buildDimensionFilters(crash, includeStateFilter)

    for (const combo of combos) {
      const where: Record<string, unknown> = {
        AND: combo.filters,
      }

      if (excludeCrashId) {
        ;(where as Record<string, unknown>).id = { not: excludeCrashId }
      }

      const matches = await prisma.crash.findMany({
        where,
        take: maxResults,
        include: {
          vehicles: { select: { id: true, bodyType: true } },
          persons: { select: { injuryStatus: true, personType: true } },
        },
      })

      if (matches.length >= MIN_COHORT_SIZE || (!includeStateFilter && matches.length > 0)) {
        return buildCohort(matches)
      }
    }
  }

  // If we still have nothing, return an empty LOW-confidence cohort
  return {
    count: 0,
    confidence: 'LOW',
    severityDistribution: {},
    avgVehicles: 0,
    injuryRate: 0,
    fatalityRate: 0,
    topContributingFactors: [],
    dateRange: { earliest: new Date(), latest: new Date() },
  }
}

interface MatchedCrash {
  id: string
  crashSeverity: string | null
  crashDate: Date
  crashRelatedFactors: string[]
  vehicles: { id: string; bodyType: string | null }[]
  persons: { injuryStatus: string | null; personType: string }[]
}

function buildCohort(matches: MatchedCrash[]): ComparableCohort {
  const count = matches.length

  // Confidence based on count
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  if (count >= 50) confidence = 'HIGH'
  else if (count >= 20) confidence = 'MEDIUM'
  else confidence = 'LOW'

  // Severity distribution
  const severityDistribution: Record<string, number> = {}
  for (const m of matches) {
    const sev = m.crashSeverity || 'UNKNOWN'
    severityDistribution[sev] = (severityDistribution[sev] || 0) + 1
  }

  // Average vehicles
  const totalVehicles = matches.reduce((sum, m) => sum + m.vehicles.length, 0)
  const avgVehicles = count > 0 ? totalVehicles / count : 0

  // Injury and fatality rates
  const allPersons = matches.flatMap((m) => m.persons)
  const totalPersons = allPersons.length
  const injuredPersons = allPersons.filter(
    (p) =>
      p.injuryStatus === 'FATAL' ||
      p.injuryStatus === 'SUSPECTED_SERIOUS' ||
      p.injuryStatus === 'SUSPECTED_MINOR' ||
      p.injuryStatus === 'POSSIBLE'
  ).length
  const fatalPersons = allPersons.filter((p) => p.injuryStatus === 'FATAL').length

  const injuryRate = totalPersons > 0 ? injuredPersons / totalPersons : 0
  const fatalityRate = totalPersons > 0 ? fatalPersons / totalPersons : 0

  // Top contributing factors
  const factorCounts: Record<string, number> = {}
  for (const m of matches) {
    for (const f of m.crashRelatedFactors) {
      factorCounts[f] = (factorCounts[f] || 0) + 1
    }
  }
  const topContributingFactors = Object.entries(factorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([factor]) => factor)

  // Date range
  const dates = matches.map((m) => m.crashDate)
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())))

  return {
    count,
    confidence,
    severityDistribution,
    avgVehicles,
    injuryRate,
    fatalityRate,
    topContributingFactors,
    dateRange: { earliest, latest },
  }
}
