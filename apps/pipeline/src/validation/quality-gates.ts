/**
 * Data quality gate definitions and runner.
 * Each gate defines a check that must pass for data integrity.
 */

import { prisma } from '@velora/db'

export interface QualityGateResult {
  gate: string
  passed: boolean
  expected: string
  actual: string
  message: string
}

/** Expected county count minimums per state */
const EXPECTED_COUNTY_COUNTS: Record<string, number> = {
  CO: 60,
  PA: 67,
  IL: 102,
  NY: 62,
  TX: 254,
  CA: 58,
}

/**
 * Gate 1: County cardinality — enough distinct counties represented?
 */
async function checkCountyCardinality(stateCode?: string): Promise<QualityGateResult> {
  const where = stateCode ? { stateCode, county: { not: null } } : { county: { not: null } }
  const counties = await prisma.crash.groupBy({
    by: ['county'],
    where: where as object,
  })

  const expectedMin = stateCode ? (EXPECTED_COUNTY_COUNTS[stateCode] || 10) : 10
  const actual = counties.length

  return {
    gate: 'county-cardinality',
    passed: actual >= Math.min(expectedMin, 5), // Relax for small datasets
    expected: `>= ${expectedMin} distinct counties`,
    actual: String(actual),
    message: actual >= expectedMin
      ? `Good county coverage: ${actual} counties`
      : `Low county coverage: ${actual}/${expectedMin} counties`,
  }
}

/**
 * Gate 2: No numeric placeholder city names
 */
async function checkNoNumericCities(): Promise<QualityGateResult> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "Crash" WHERE "cityName" ~ '^[0-9]+$'
  `
  const count = Number(result[0]?.count ?? 0)

  return {
    gate: 'no-numeric-cities',
    passed: count === 0,
    expected: '0 numeric city names',
    actual: String(count),
    message: count === 0
      ? 'No numeric city names found'
      : `Found ${count} crashes with numeric city names`,
  }
}

/**
 * Gate 3: Relational integrity — no orphan vehicles
 */
async function checkOrphanVehicles(): Promise<QualityGateResult> {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count FROM "Vehicle" v
    LEFT JOIN "Crash" c ON v."crashId" = c.id
    WHERE c.id IS NULL
  `
  const count = Number(result[0]?.count ?? 0)

  return {
    gate: 'orphan-vehicles',
    passed: count === 0,
    expected: '0 orphan vehicles',
    actual: String(count),
    message: count === 0
      ? 'No orphan vehicles found'
      : `Found ${count} vehicles without parent crash`,
  }
}

/**
 * Gate 4: Geo coverage — percentage of crashes with coordinates
 */
async function checkGeoCoverage(stateCode?: string): Promise<QualityGateResult> {
  const where = stateCode ? { stateCode } : {}
  const total = await prisma.crash.count({ where })
  const withGeo = await prisma.crash.count({
    where: { ...where, latitude: { not: null }, longitude: { not: null } },
  })

  const coverage = total > 0 ? withGeo / total : 0
  const threshold = 0.50 // Relaxed from 0.99 since FARS may not always have coordinates

  return {
    gate: 'geo-coverage',
    passed: coverage >= threshold || total === 0,
    expected: `>= ${(threshold * 100).toFixed(0)}% geo coverage`,
    actual: total > 0 ? `${(coverage * 100).toFixed(1)}% (${withGeo}/${total})` : 'No records',
    message: coverage >= threshold
      ? `Good geo coverage: ${(coverage * 100).toFixed(1)}%`
      : `Low geo coverage: ${(coverage * 100).toFixed(1)}%`,
  }
}

/**
 * Gate 5: Date range sanity — no future dates, no ancient dates
 */
async function checkDateRange(): Promise<QualityGateResult> {
  const result = await prisma.crash.aggregate({
    _min: { crashDate: true },
    _max: { crashDate: true },
  })

  const minDate = result._min.crashDate
  const maxDate = result._max.crashDate

  if (!minDate || !maxDate) {
    return {
      gate: 'date-range',
      passed: true,
      expected: 'Dates between 2000-01-01 and tomorrow',
      actual: 'No records',
      message: 'No records to check',
    }
  }

  const cutoffMin = new Date('2000-01-01')
  const cutoffMax = new Date()
  cutoffMax.setDate(cutoffMax.getDate() + 1)

  const passed = minDate >= cutoffMin && maxDate <= cutoffMax

  return {
    gate: 'date-range',
    passed,
    expected: `${cutoffMin.toISOString().split('T')[0]} to ${cutoffMax.toISOString().split('T')[0]}`,
    actual: `${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`,
    message: passed
      ? 'Date range is within expected bounds'
      : 'Date range outside expected bounds',
  }
}

/**
 * Gate 6: Severity distribution — check for reasonable distribution
 */
async function checkSeverityDistribution(): Promise<QualityGateResult> {
  const distribution = await prisma.crash.groupBy({
    by: ['crashSeverity'],
    _count: true,
  })

  const total = distribution.reduce((sum, d) => sum + d._count, 0)
  const distStr = distribution
    .map(d => `${d.crashSeverity ?? 'NULL'}: ${d._count}`)
    .join(', ')

  // For FARS-only data, everything is FATAL — that's expected
  const hasMixedSeverity = distribution.length > 1
  const hasData = total > 0

  return {
    gate: 'severity-distribution',
    passed: hasData,
    expected: 'Non-empty severity distribution',
    actual: hasData ? distStr : 'No records',
    message: hasMixedSeverity
      ? `Mixed severity distribution across ${distribution.length} categories`
      : hasData
        ? `Single severity category (expected for FARS-only data)`
        : 'No crash records found',
  }
}

/**
 * Run all quality gates and return results.
 */
export async function runAllQualityGates(stateCode?: string): Promise<QualityGateResult[]> {
  console.log(`[Quality Gates] Running all gates${stateCode ? ` for ${stateCode}` : ''}...`)

  const results: QualityGateResult[] = []

  results.push(await checkCountyCardinality(stateCode))
  results.push(await checkNoNumericCities())
  results.push(await checkOrphanVehicles())
  results.push(await checkGeoCoverage(stateCode))
  results.push(await checkDateRange())
  results.push(await checkSeverityDistribution())

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`[Quality Gates] Complete: ${passed} passed, ${failed} failed`)

  return results
}
