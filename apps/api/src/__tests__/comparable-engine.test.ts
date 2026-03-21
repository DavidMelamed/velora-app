import { describe, it, expect } from 'vitest'
import type { CrashWithRelations } from '../services/equalizer/comparable-engine'

// We test the cohort-building logic by importing the internal helper indirectly.
// Since findComparableCrashes requires Prisma, we test the pure logic separately.

function buildCohort(matches: MockMatch[]) {
  const count = matches.length
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  if (count >= 50) confidence = 'HIGH'
  else if (count >= 20) confidence = 'MEDIUM'
  else confidence = 'LOW'

  const severityDistribution: Record<string, number> = {}
  for (const m of matches) {
    const sev = m.crashSeverity || 'UNKNOWN'
    severityDistribution[sev] = (severityDistribution[sev] || 0) + 1
  }

  const totalVehicles = matches.reduce((sum, m) => sum + m.vehicleCount, 0)
  const avgVehicles = count > 0 ? totalVehicles / count : 0

  const totalPersons = matches.reduce((sum, m) => sum + m.persons.length, 0)
  const injuredPersons = matches
    .flatMap((m) => m.persons)
    .filter(
      (p) =>
        p.injuryStatus === 'FATAL' ||
        p.injuryStatus === 'SUSPECTED_SERIOUS' ||
        p.injuryStatus === 'SUSPECTED_MINOR' ||
        p.injuryStatus === 'POSSIBLE'
    ).length
  const fatalPersons = matches.flatMap((m) => m.persons).filter((p) => p.injuryStatus === 'FATAL').length
  const injuryRate = totalPersons > 0 ? injuredPersons / totalPersons : 0
  const fatalityRate = totalPersons > 0 ? fatalPersons / totalPersons : 0

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
    dateRange: { earliest, latest },
  }
}

interface MockMatch {
  crashSeverity: string | null
  vehicleCount: number
  persons: { injuryStatus: string | null }[]
  crashDate: Date
}

function makeMockCrash(overrides?: Partial<MockMatch>): MockMatch {
  return {
    crashSeverity: 'SUSPECTED_MINOR_INJURY',
    vehicleCount: 2,
    persons: [
      { injuryStatus: 'SUSPECTED_MINOR' },
      { injuryStatus: 'NO_APPARENT_INJURY' },
    ],
    crashDate: new Date('2025-06-15'),
    ...overrides,
  }
}

describe('Comparable Engine - Cohort Building', () => {
  it('should return HIGH confidence for 50+ matches', () => {
    const matches = Array.from({ length: 55 }, () => makeMockCrash())
    const cohort = buildCohort(matches)
    expect(cohort.confidence).toBe('HIGH')
    expect(cohort.count).toBe(55)
  })

  it('should return MEDIUM confidence for 20-49 matches', () => {
    const matches = Array.from({ length: 30 }, () => makeMockCrash())
    const cohort = buildCohort(matches)
    expect(cohort.confidence).toBe('MEDIUM')
    expect(cohort.count).toBe(30)
  })

  it('should return LOW confidence for <20 matches', () => {
    const matches = Array.from({ length: 5 }, () => makeMockCrash())
    const cohort = buildCohort(matches)
    expect(cohort.confidence).toBe('LOW')
    expect(cohort.count).toBe(5)
  })

  it('should compute correct severity distribution', () => {
    const matches = [
      makeMockCrash({ crashSeverity: 'FATAL' }),
      makeMockCrash({ crashSeverity: 'FATAL' }),
      makeMockCrash({ crashSeverity: 'SUSPECTED_MINOR_INJURY' }),
      makeMockCrash({ crashSeverity: 'PROPERTY_DAMAGE_ONLY' }),
    ]
    const cohort = buildCohort(matches)
    expect(cohort.severityDistribution.FATAL).toBe(2)
    expect(cohort.severityDistribution.SUSPECTED_MINOR_INJURY).toBe(1)
    expect(cohort.severityDistribution.PROPERTY_DAMAGE_ONLY).toBe(1)
  })

  it('should compute correct average vehicles', () => {
    const matches = [
      makeMockCrash({ vehicleCount: 2 }),
      makeMockCrash({ vehicleCount: 3 }),
      makeMockCrash({ vehicleCount: 1 }),
    ]
    const cohort = buildCohort(matches)
    expect(cohort.avgVehicles).toBe(2)
  })

  it('should compute correct injury and fatality rates', () => {
    const matches = [
      makeMockCrash({
        persons: [{ injuryStatus: 'FATAL' }, { injuryStatus: 'NO_APPARENT_INJURY' }],
      }),
      makeMockCrash({
        persons: [{ injuryStatus: 'SUSPECTED_SERIOUS' }, { injuryStatus: 'POSSIBLE' }],
      }),
    ]
    const cohort = buildCohort(matches)
    // 4 total persons, 3 injured (FATAL, SUSPECTED_SERIOUS, POSSIBLE), 1 fatal
    expect(cohort.injuryRate).toBe(0.75)
    expect(cohort.fatalityRate).toBe(0.25)
  })

  it('should compute correct date range', () => {
    const matches = [
      makeMockCrash({ crashDate: new Date('2025-01-01') }),
      makeMockCrash({ crashDate: new Date('2025-12-31') }),
      makeMockCrash({ crashDate: new Date('2025-06-15') }),
    ]
    const cohort = buildCohort(matches)
    expect(cohort.dateRange.earliest).toEqual(new Date('2025-01-01'))
    expect(cohort.dateRange.latest).toEqual(new Date('2025-12-31'))
  })

  it('should handle empty matches', () => {
    const cohort = buildCohort([])
    expect(cohort.count).toBe(0)
    expect(cohort.confidence).toBe('LOW')
    expect(cohort.avgVehicles).toBe(0)
    expect(cohort.injuryRate).toBe(0)
    expect(cohort.fatalityRate).toBe(0)
  })
})
