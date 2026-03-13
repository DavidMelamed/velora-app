/**
 * Data quality gate definitions for the pipeline.
 * Each gate defines a check that must pass before data moves to the next stage.
 */

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

export const QUALITY_GATES = {
  /** Gate 1: County cardinality — enough distinct counties? */
  countyCardinalityMin: (stateCode: string): number => {
    return EXPECTED_COUNTY_COUNTS[stateCode] || 10
  },

  /** Gate 2: No numeric placeholder city names */
  noNumericCitiesQuery: `SELECT COUNT(*) as count FROM "Crash" WHERE "cityName" ~ '^[0-9]+$'`,

  /** Gate 3: Relational integrity — no orphan vehicles */
  orphanVehiclesQuery: `SELECT COUNT(*) as count FROM "Vehicle" v LEFT JOIN "Crash" c ON v."crashId" = c.id WHERE c.id IS NULL`,

  /** Gate 4: Geo coverage — at least 99% of crashes have coordinates */
  geoCoverageQuery: (stateCode: string): string =>
    `SELECT COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM "Crash" WHERE "stateCode" = '${stateCode}'), 0) as coverage FROM "Crash" WHERE "stateCode" = '${stateCode}' AND latitude IS NOT NULL`,

  /** Gate 5: Date range sanity — no future dates, no ancient dates */
  dateRangeQuery: `SELECT MIN("crashDate") as min_date, MAX("crashDate") as max_date FROM "Crash"`,

  /** Gate 6: Severity distribution — PDO should be >50% (national avg ~70%) */
  severityDistributionQuery: `SELECT "crashSeverity", COUNT(*) as count FROM "Crash" GROUP BY "crashSeverity"`,
}

/**
 * Run all quality gates for a given state.
 * Stub — actual implementation will run queries against Prisma in Phase 0.
 */
export async function runQualityGates(_stateCode: string): Promise<QualityGateResult[]> {
  console.log('[Quality Gates] Not yet implemented — pending Phase 0')
  return []
}
