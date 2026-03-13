/**
 * Geo assignment — match crash lat/lng to nearest GeoEntity (state, county, city).
 * Uses simple bounding box matching since we don't have geometry polygons.
 */

import { prisma } from '@velora/db'

export interface GeoAssignment {
  stateId?: string
  countyId?: string
  cityId?: string
}

/**
 * Assign a crash to the appropriate GeoEntity based on state code.
 * For now, assigns to the state-level entity.
 * Future: county/city matching via PostGIS or polygon intersection.
 */
export async function assignGeo(
  stateCode: string,
  _latitude?: number | null,
  _longitude?: number | null,
): Promise<GeoAssignment> {
  // Find the state entity
  const stateEntity = await prisma.geoEntity.findFirst({
    where: {
      type: 'STATE',
      stateCode,
    },
  })

  return {
    stateId: stateEntity?.id,
  }
}

/**
 * Batch geo assignment — preloads state entities for efficiency.
 */
export async function assignGeoBatch(
  records: Array<{ stateCode: string; latitude?: number | null; longitude?: number | null }>,
): Promise<Map<number, GeoAssignment>> {
  // Preload all state entities
  const states = await prisma.geoEntity.findMany({
    where: { type: 'STATE' },
  })
  const stateMap = new Map(states.map(s => [s.stateCode, s.id]))

  const result = new Map<number, GeoAssignment>()
  for (let i = 0; i < records.length; i++) {
    result.set(i, {
      stateId: stateMap.get(records[i].stateCode),
    })
  }

  return result
}
