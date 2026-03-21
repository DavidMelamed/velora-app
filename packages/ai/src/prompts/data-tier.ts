/**
 * Data tier classification for crash records.
 * Determines how much data is available to generate quality narratives.
 */

export type DataTier = 'RICH' | 'STANDARD' | 'MINIMAL'

interface CrashLike {
  vehicles?: Array<{
    driver?: unknown
    make?: string | null
    modelYear?: number | null
  }> | null
  persons?: unknown[] | null
  atmosphericCondition?: string | null
  lightCondition?: string | null
  mannerOfCollision?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * Classify a crash record by data richness.
 * RICH (8+): Full vehicle details, persons, driver info, conditions
 * STANDARD (4-7): Some vehicles/persons, basic conditions
 * MINIMAL (<4): Bare minimum fields only
 */
export function classifyDataTier(crash: CrashLike): DataTier {
  let score = 0

  if (crash.vehicles && crash.vehicles.length > 0) score += 2
  if (crash.persons && crash.persons.length > 0) score += 2
  if (crash.vehicles?.some((v) => v.driver)) score += 2
  if (crash.atmosphericCondition) score++
  if (crash.lightCondition) score++
  if (crash.mannerOfCollision) score++
  if (crash.latitude && crash.longitude) score++
  if (crash.vehicles?.some((v) => v.make && v.modelYear)) score += 2

  if (score >= 8) return 'RICH'
  if (score >= 4) return 'STANDARD'
  return 'MINIMAL'
}

/**
 * Get a description of what data quality to expect for each tier.
 */
export function getDataTierDescription(tier: DataTier): string {
  switch (tier) {
    case 'RICH':
      return 'Full crash details with vehicle specifics, driver information, and environmental conditions'
    case 'STANDARD':
      return 'Basic crash details with some vehicle and condition information'
    case 'MINIMAL':
      return 'Limited crash data — narrative will rely on available fields only'
  }
}
