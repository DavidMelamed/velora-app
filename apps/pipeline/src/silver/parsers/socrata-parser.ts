/**
 * Socrata-to-MMUCC field mapper.
 * Per-city field mapping for Socrata crash datasets.
 *
 * NYC: Motor Vehicle Collisions - Crashes (h9gi-nx95)
 * Chicago: Traffic Crashes - Crashes (85ca-t3if)
 */

import type { BronzeRecord } from '../../bronze/types'
import type { CrashSilver, VehicleSilver, PersonSilver } from '../schemas'

export interface SocrataParsedResult {
  crash: Partial<CrashSilver>
  vehicles: Partial<VehicleSilver>[]
  persons: Partial<PersonSilver>[]
}

function asNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  return String(v).trim()
}

/** Map severity values to MMUCC crash severity */
function mapSeverity(val: unknown): CrashSilver['crashSeverity'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('FATAL')) return 'FATAL'
  if (s.includes('INCAPACITATING') || s.includes('SERIOUS')) return 'SUSPECTED_SERIOUS_INJURY'
  if (s.includes('NON-INCAPACITATING') || s.includes('MINOR') || s.includes('EVIDENT')) return 'SUSPECTED_MINOR_INJURY'
  if (s.includes('POSSIBLE') || s.includes('REPORTED')) return 'POSSIBLE_INJURY'
  if (s.includes('NO INDICATION') || s.includes('NONE') || s.includes('NO INJURY')) return 'PROPERTY_DAMAGE_ONLY'
  return undefined
}

/** Map weather values to MMUCC atmospheric condition */
function mapWeather(val: unknown): CrashSilver['atmosphericCondition'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('CLEAR')) return 'CLEAR'
  if (s.includes('CLOUD') || s.includes('OVERCAST')) return 'CLOUDY'
  if (s.includes('RAIN')) return 'RAIN'
  if (s.includes('SLEET') || s.includes('HAIL') || s.includes('FREEZING')) return 'SLEET_HAIL_FREEZING_RAIN'
  if (s.includes('SNOW') || s.includes('BLOWING SNOW')) return 'SNOW'
  if (s.includes('FOG') || s.includes('SMOG') || s.includes('SMOKE')) return 'FOG_SMOG_SMOKE'
  if (s.includes('WIND') || s.includes('CROSSWIND')) return 'SEVERE_CROSSWINDS'
  return 'OTHER'
}

/** Map light conditions to MMUCC */
function mapLight(val: unknown): CrashSilver['lightCondition'] {
  if (val === null || val === undefined) return undefined
  const s = String(val).toUpperCase()
  if (s.includes('DAYLIGHT')) return 'DAYLIGHT'
  if (s.includes('DARK') && s.includes('LIT')) return 'DARK_LIGHTED'
  if (s.includes('DARK') && s.includes('NOT') && s.includes('LIT')) return 'DARK_NOT_LIGHTED'
  if (s.includes('DARK')) return 'DARK_UNKNOWN_LIGHTING'
  if (s.includes('DAWN')) return 'DAWN'
  if (s.includes('DUSK')) return 'DUSK'
  return 'OTHER'
}

/** Map vehicle type string to MMUCC body type */
function mapVehicleType(val: string): VehicleSilver['bodyType'] {
  const s = val.toUpperCase()
  if (s.includes('SEDAN') || s.includes('PASSENGER')) return 'PASSENGER_CAR'
  if (s.includes('SUV') || s.includes('SPORT UTILITY')) return 'SUV'
  if (s.includes('PICKUP') || s.includes('PICK-UP')) return 'PICKUP'
  if (s.includes('VAN')) return 'VAN'
  if (s.includes('MOTORCYCLE') || s.includes('MOTORBIKE')) return 'MOTORCYCLE'
  if (s.includes('BUS') || s.includes('OMNIBUS')) return 'BUS_LARGE'
  if (s.includes('TRUCK') || s.includes('TRACTOR')) return 'MEDIUM_HEAVY_TRUCK'
  if (s.includes('BICYCLE') || s.includes('BIKE')) return 'OTHER'
  return 'OTHER'
}

/**
 * Parse NYC Motor Vehicle Collisions (dataset h9gi-nx95).
 * Fields: crash_date, crash_time, borough, zip_code, latitude, longitude,
 *         number_of_persons_injured, number_of_persons_killed, contributing_factor_vehicle_1, etc.
 */
function parseNYCRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  const crashDate = raw.crash_date
  if (!crashDate) return null

  const dateStr = String(crashDate)
  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  const killed = asNum(raw.number_of_persons_killed) ?? 0
  const injured = asNum(raw.number_of_persons_injured) ?? 0

  let severity: CrashSilver['crashSeverity'] = 'PROPERTY_DAMAGE_ONLY'
  if (killed > 0) severity = 'FATAL'
  else if (injured > 0) severity = 'SUSPECTED_MINOR_INJURY'

  const collisionId = asStr(raw.collision_id) ?? `nyc-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `NYC-${collisionId}`,
    crashDate: parsedDate,
    crashTime: asStr(raw.crash_time),
    county: asStr(raw.borough) ?? 'NEW YORK',
    latitude: asNum(raw.latitude),
    longitude: asNum(raw.longitude),
    crashSeverity: severity,
    stateCode: 'NY',
    dataSource: 'socrata-nyc',
  }

  // NYC data doesn't have detailed vehicle/person breakdown in the crashes dataset
  const vehicles: Partial<VehicleSilver>[] = []
  const vehicleTypes = ['vehicle_type_code1', 'vehicle_type_code2', 'vehicle_type_code_3', 'vehicle_type_code_4', 'vehicle_type_code_5']
  for (let i = 0; i < vehicleTypes.length; i++) {
    const vType = asStr(raw[vehicleTypes[i]])
    if (vType) {
      vehicles.push({
        bodyType: mapVehicleType(vType),
      })
    }
  }

  return { crash, vehicles, persons: [] }
}

/**
 * Parse Chicago Traffic Crashes (dataset 85ca-t3if).
 * Fields: crash_record_id, crash_date, posted_speed_limit, weather_condition,
 *         lighting_condition, injuries_total, injuries_fatal, crash_type, etc.
 */
function parseChicagoRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  const crashDate = raw.crash_date
  if (!crashDate) return null

  const dateStr = String(crashDate)
  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  const crashId = asStr(raw.crash_record_id) ?? `chi-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const killed = asNum(raw.injuries_fatal) ?? 0
  const injured = asNum(raw.injuries_total) ?? 0

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `CHI-${crashId}`,
    crashDate: parsedDate,
    county: 'COOK',
    latitude: asNum(raw.latitude),
    longitude: asNum(raw.longitude),
    crashSeverity: mapSeverity(raw.most_severe_injury) ?? (killed > 0 ? 'FATAL' : injured > 0 ? 'SUSPECTED_MINOR_INJURY' : 'PROPERTY_DAMAGE_ONLY'),
    atmosphericCondition: mapWeather(raw.weather_condition),
    lightCondition: mapLight(raw.lighting_condition),
    stateCode: 'IL',
    dataSource: 'socrata-chicago',
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Parse a Socrata BronzeRecord based on its source.
 * Routes to city-specific parser.
 */
export function parseSocrataRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const source = bronze.source

  if (source === 'socrata-nyc') {
    return parseNYCRecord(bronze)
  }

  if (source === 'socrata-chicago') {
    return parseChicagoRecord(bronze)
  }

  console.warn(`[SocrataParser] Unknown Socrata source: ${source}`)
  return null
}
