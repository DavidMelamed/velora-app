/**
 * ArcGIS-to-MMUCC field mapper.
 * Each state's ArcGIS endpoint uses different field names.
 * The parser uses per-state field mapping configs.
 */

import type { BronzeRecord } from '../../bronze/types'
import type { CrashSilver, VehicleSilver, PersonSilver } from '../schemas'
import type { ArcGISStateMapping } from '../../config/arcgis-states'

function asNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  return String(v).trim()
}

/** Map string severity values to MMUCC crash severity */
function mapSeverity(val: unknown): CrashSilver['crashSeverity'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('FATAL') || s === '4' || s === 'K') return 'FATAL'
  if (s.includes('SERIOUS') || s.includes('INCAPACITATING') || s === '3' || s === 'A') return 'SUSPECTED_SERIOUS_INJURY'
  if (s.includes('MINOR') || s.includes('NON-INCAPACITATING') || s === '2' || s === 'B') return 'SUSPECTED_MINOR_INJURY'
  if (s.includes('POSSIBLE') || s.includes('COMPLAINT') || s === '1' || s === 'C') return 'POSSIBLE_INJURY'
  if (s.includes('PDO') || s.includes('PROPERTY') || s.includes('NONE') || s === '0' || s === 'O') return 'PROPERTY_DAMAGE_ONLY'
  return undefined
}

/** Map weather values to MMUCC atmospheric condition */
function mapWeather(val: unknown): CrashSilver['atmosphericCondition'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('CLEAR')) return 'CLEAR'
  if (s.includes('CLOUD') || s.includes('OVERCAST')) return 'CLOUDY'
  if (s.includes('RAIN')) return 'RAIN'
  if (s.includes('SNOW') && s.includes('BLOW')) return 'BLOWING_SNOW'
  if (s.includes('SNOW')) return 'SNOW'
  if (s.includes('SLEET') || s.includes('HAIL') || s.includes('FREEZ')) return 'SLEET_HAIL_FREEZING_RAIN'
  if (s.includes('FOG') || s.includes('SMOG') || s.includes('SMOKE')) return 'FOG_SMOG_SMOKE'
  if (s.includes('WIND')) return 'SEVERE_CROSSWINDS'
  if (s.includes('SAND') || s.includes('DIRT')) return 'BLOWING_SAND_SOIL_DIRT'
  return 'OTHER'
}

/** Map light condition values to MMUCC */
function mapLightCondition(val: unknown): CrashSilver['lightCondition'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('DAYLIGHT') || s.includes('DAY')) return 'DAYLIGHT'
  if (s.includes('DAWN')) return 'DAWN'
  if (s.includes('DUSK')) return 'DUSK'
  if (s.includes('DARK') && s.includes('LIGHT')) return 'DARK_LIGHTED'
  if (s.includes('DARK') && s.includes('NOT')) return 'DARK_NOT_LIGHTED'
  if (s.includes('DARK')) return 'DARK_UNKNOWN_LIGHTING'
  return 'OTHER'
}

/** Map collision manner values to MMUCC */
function mapMannerOfCollision(val: unknown): CrashSilver['mannerOfCollision'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('REAR') && s.includes('END')) return 'FRONT_TO_REAR'
  if (s.includes('FRONT') && s.includes('REAR')) return 'FRONT_TO_REAR'
  if (s.includes('HEAD') && s.includes('ON')) return 'FRONT_TO_FRONT'
  if (s.includes('ANGLE')) return 'ANGLE'
  if (s.includes('SIDESWIPE') && s.includes('SAME')) return 'SIDESWIPE_SAME_DIRECTION'
  if (s.includes('SIDESWIPE') && s.includes('OPP')) return 'SIDESWIPE_OPPOSITE_DIRECTION'
  if (s.includes('NOT') && s.includes('COLLISION')) return 'NOT_COLLISION_WITH_MV'
  if (s.includes('REAR') && s.includes('SIDE')) return 'REAR_TO_SIDE'
  return 'OTHER'
}

/** Parse date from ArcGIS — could be epoch ms, ISO string, or various formats */
function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') {
    // ArcGIS often returns epoch milliseconds
    if (val > 1e12) return new Date(val)
    if (val > 1e9) return new Date(val * 1000)
    return null
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

export interface ArcGISParsedResult {
  crash: CrashSilver
  vehicles: VehicleSilver[]
  persons: PersonSilver[]
}

/**
 * Parse an ArcGIS BronzeRecord into Silver (MMUCC-mapped) records.
 */
export function parseArcGISRecord(bronze: BronzeRecord, mapping: ArcGISStateMapping): ArcGISParsedResult | null {
  const raw = bronze.rawData as Record<string, unknown>
  const fm = mapping.fieldMapping

  // Extract unique ID
  const uniqueIdRaw = raw[fm.uniqueId]
  if (!uniqueIdRaw) return null

  const stateUniqueId = `ARCGIS-${bronze.stateCode}-${uniqueIdRaw}`

  // Parse crash date
  const dateVal = raw[fm.crashDate]
  const crashDate = parseDate(dateVal)
  if (!crashDate) return null

  // Extract coordinates
  let latitude = asNum(raw[fm.latitude ?? 'LATITUDE'])
  let longitude = asNum(raw[fm.longitude ?? 'LONGITUDE'])

  // Also check geometry object
  if (latitude === undefined || longitude === undefined) {
    const geo = raw._geometry as Record<string, unknown> | undefined
    if (geo) {
      latitude = latitude ?? asNum(geo.y ?? geo.lat)
      longitude = longitude ?? asNum(geo.x ?? geo.lng ?? geo.lon)
    }
  }

  const crash: CrashSilver = {
    stateUniqueId,
    crashDate,
    crashTime: asStr(raw[fm.crashTime ?? '___']),
    county: asStr(raw[fm.county ?? 'COUNTY'] ?? raw[fm.county ?? 'COUNTY_NAME']),
    latitude,
    longitude,
    mannerOfCollision: mapMannerOfCollision(raw[fm.mannerOfCollision ?? '___']),
    atmosphericCondition: mapWeather(raw[fm.weather ?? '___']),
    lightCondition: mapLightCondition(raw[fm.lightCondition ?? '___']),
    crashSeverity: mapSeverity(raw[fm.severity ?? '___']),
    stateCode: bronze.stateCode,
    dataSource: `ARCGIS-${bronze.stateCode}`,
  }

  // ArcGIS crash records are typically at the crash level — vehicle/person data
  // is often in separate layers or not available. Return empty arrays.
  const vehicles: VehicleSilver[] = []
  const persons: PersonSilver[] = []

  return { crash, vehicles, persons }
}
