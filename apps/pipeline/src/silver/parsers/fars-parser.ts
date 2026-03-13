/**
 * FARS-to-MMUCC field mapper.
 * Maps FARS ACCIDENT-level data to CrashSilver schema.
 * FARS uses numeric codes for most fields.
 *
 * Key FARS tables: ACCIDENT, VEHICLE, PERSON
 * Join keys: ST_CASE + VEH_NO + PER_NO
 */

import type { BronzeRecord } from '../../bronze/types'
import type { CrashSilver, VehicleSilver, PersonSilver } from '../schemas'
import { STATE_BY_FIPS } from '@velora/shared'

/** FARS manner of collision codes → MMUCC */
const MANNER_OF_COLLISION_MAP: Record<number, CrashSilver['mannerOfCollision']> = {
  0: 'NOT_COLLISION_WITH_MV',
  1: 'FRONT_TO_REAR',
  2: 'FRONT_TO_FRONT',
  6: 'ANGLE',
  3: 'SIDESWIPE_SAME_DIRECTION',
  4: 'SIDESWIPE_OPPOSITE_DIRECTION',
  5: 'REAR_TO_SIDE',
  7: 'REAR_TO_REAR',
  8: 'OTHER',
  9: 'UNKNOWN',
  98: 'OTHER',
  99: 'UNKNOWN',
}

/** FARS atmospheric condition codes → MMUCC */
const WEATHER_MAP: Record<number, CrashSilver['atmosphericCondition']> = {
  1: 'CLEAR',
  2: 'RAIN',
  3: 'SLEET_HAIL_FREEZING_RAIN',
  4: 'SNOW',
  5: 'FOG_SMOG_SMOKE',
  6: 'SEVERE_CROSSWINDS',
  7: 'BLOWING_SAND_SOIL_DIRT',
  8: 'OTHER',
  10: 'CLOUDY',
  11: 'BLOWING_SNOW',
  98: 'OTHER',
  99: 'UNKNOWN',
}

/** FARS light condition codes → MMUCC */
const LIGHT_MAP: Record<number, CrashSilver['lightCondition']> = {
  1: 'DAYLIGHT',
  2: 'DARK_NOT_LIGHTED',
  3: 'DARK_LIGHTED',
  4: 'DAWN',
  5: 'DUSK',
  6: 'DARK_UNKNOWN_LIGHTING',
  7: 'OTHER',
  9: 'UNKNOWN',
}

/** FARS person type codes → MMUCC */
const PERSON_TYPE_MAP: Record<number, PersonSilver['personType']> = {
  1: 'DRIVER',
  2: 'PASSENGER',
  5: 'PEDESTRIAN',
  6: 'PEDALCYCLIST',
  7: 'OCCUPANT_OF_NON_MV',
  8: 'OTHER',
  9: 'UNKNOWN',
  19: 'UNKNOWN',
}

/** FARS sex codes → MMUCC */
const SEX_MAP: Record<number, NonNullable<PersonSilver['sex']>> = {
  1: 'MALE',
  2: 'FEMALE',
  8: 'NOT_REPORTED',
  9: 'UNKNOWN',
}

/** FARS injury severity codes → MMUCC KABCO */
const INJURY_MAP: Record<number, NonNullable<PersonSilver['injuryStatus']>> = {
  0: 'NO_APPARENT_INJURY',
  1: 'POSSIBLE',
  2: 'SUSPECTED_MINOR',
  3: 'SUSPECTED_SERIOUS',
  4: 'FATAL',
  5: 'UNKNOWN' as NonNullable<PersonSilver['injuryStatus']>,
  6: 'UNKNOWN' as NonNullable<PersonSilver['injuryStatus']>,
  9: 'UNKNOWN' as NonNullable<PersonSilver['injuryStatus']>,
}

/** Helper to safely get nested value */
function getVal(obj: Record<string, unknown>, key: string): unknown {
  return obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()]
}

function asNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  return String(v)
}

/**
 * Extract the ACCIDENT-level data from a FARS GetCaseDetails response.
 * The response wraps data in Results arrays with table-specific sub-arrays.
 */
function extractAccident(rawData: Record<string, unknown>): Record<string, unknown> | null {
  // FARS GetCaseDetails returns { Results: [{ ... }] } or nested structure
  const results = rawData.Results as unknown[]
  if (Array.isArray(results) && results.length > 0) {
    // May be nested: Results[0][tableName] or Results[0] is the accident record
    const first = results[0]
    if (Array.isArray(first) && first.length > 0) {
      return first[0] as Record<string, unknown>
    }
    if (typeof first === 'object' && first !== null) {
      return first as Record<string, unknown>
    }
  }
  // Fallback: the rawData itself might contain the fields
  if (rawData.ST_CASE || rawData.st_case) {
    return rawData
  }
  return null
}

export interface FARSParsedResult {
  crash: CrashSilver
  vehicles: VehicleSilver[]
  persons: PersonSilver[]
}

/**
 * Parse a FARS BronzeRecord into Silver (MMUCC-mapped) records.
 */
export function parseFARSRecord(bronze: BronzeRecord): FARSParsedResult | null {
  const raw = bronze.rawData as Record<string, unknown>
  const accident = extractAccident(raw)

  if (!accident) {
    return null
  }

  const stCase = asNum(getVal(accident, 'ST_CASE'))
  const state = asNum(getVal(accident, 'STATE'))
  const year = asNum(getVal(accident, 'YEAR') ?? getVal(accident, 'CaseYear'))

  if (!stCase) {
    return null
  }

  // Determine state code from FIPS
  const stateFips = state ? String(state).padStart(2, '0') : undefined
  const stateConfig = stateFips ? STATE_BY_FIPS[stateFips] : undefined
  const stateCode = stateConfig?.code ?? bronze.stateCode

  // Build unique ID
  const stateUniqueId = `FARS-${stateCode}-${year ?? 'UNK'}-${stCase}`

  // Parse date
  const month = asNum(getVal(accident, 'MONTH'))
  const day = asNum(getVal(accident, 'DAY'))
  const hour = asNum(getVal(accident, 'HOUR'))
  const minute = asNum(getVal(accident, 'MINUTE'))

  let crashDate: Date
  if (year && month && day) {
    crashDate = new Date(year, month - 1, day)
  } else {
    crashDate = bronze.fetchedAt
  }

  const crashTime = (hour !== undefined && minute !== undefined && hour < 25 && minute < 61)
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : undefined

  const crash: CrashSilver = {
    stateUniqueId,
    crashDate,
    crashTime,
    county: asStr(getVal(accident, 'COUNTYNAME') ?? getVal(accident, 'COUNTY')),
    latitude: asNum(getVal(accident, 'LATITUDE')),
    longitude: asNum(getVal(accident, 'LONGITUD')),
    mannerOfCollision: MANNER_OF_COLLISION_MAP[asNum(getVal(accident, 'MAN_COLL')) ?? -1],
    atmosphericCondition: WEATHER_MAP[asNum(getVal(accident, 'WEATHER')) ?? -1],
    lightCondition: LIGHT_MAP[asNum(getVal(accident, 'LGT_COND')) ?? -1],
    crashSeverity: 'FATAL', // FARS only has fatal crashes
    stateCode,
    dataSource: 'FARS',
  }

  // Parse vehicles if available
  const vehicles: VehicleSilver[] = []
  const vehicleData = raw.VEHICLEs ?? raw.Vehicles ?? raw.VEHICLE
  if (Array.isArray(vehicleData)) {
    for (const v of vehicleData) {
      const vRec = v as Record<string, unknown>
      vehicles.push({
        make: asStr(getVal(vRec, 'MAKENAME') ?? getVal(vRec, 'MAKE')),
        modelYear: asNum(getVal(vRec, 'MOD_YEAR')),
        model: asStr(getVal(vRec, 'MODELNAME') ?? getVal(vRec, 'MODEL')),
        speedLimit: asNum(getVal(vRec, 'SP_LIMIT')),
        hitAndRun: asNum(getVal(vRec, 'HIT_RUN')) === 1,
      })
    }
  }

  // Parse persons if available
  const persons: PersonSilver[] = []
  const personData = raw.PERSONs ?? raw.Persons ?? raw.PERSON
  if (Array.isArray(personData)) {
    for (const p of personData) {
      const pRec = p as Record<string, unknown>
      const personTypeCode = asNum(getVal(pRec, 'PER_TYP'))
      persons.push({
        personType: PERSON_TYPE_MAP[personTypeCode ?? -1] ?? 'UNKNOWN',
        injuryStatus: INJURY_MAP[asNum(getVal(pRec, 'INJ_SEV')) ?? -1],
        sex: SEX_MAP[asNum(getVal(pRec, 'SEX')) ?? -1],
        seatingPosition: asStr(getVal(pRec, 'SEAT_POS')),
      })
    }
  }

  return { crash, vehicles, persons }
}
