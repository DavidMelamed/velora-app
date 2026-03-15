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
    cityName: 'New York',
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
    cityName: 'Chicago',
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
 * Parse Denver/Colorado Traffic Accidents (dataset cpwf-cznk).
 * Fields: incident_id, reported_date, incident_address, geo_lat, geo_lon,
 *         top_traffic_accident_offense, seriously_injured, fatalities
 */
function parseDenverRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  // Denver fields are truncated: reported_d, first_occu, incident_i, etc.
  // Values can be epoch ms strings OR ISO date strings
  const rawDate = raw.reported_d ?? raw.reported_date ?? raw.first_occu ?? raw.first_occurrence_date
  if (!rawDate) return null

  let parsedDate: Date
  const dateVal = String(rawDate)
  // Check if it's epoch milliseconds (all digits, 13+ chars)
  if (/^\d{10,}(\.\d+)?$/.test(dateVal)) {
    parsedDate = new Date(parseInt(dateVal))
  } else {
    parsedDate = new Date(dateVal)
  }
  if (isNaN(parsedDate.getTime())) return null

  const incidentId = asStr(raw.incident_i) ?? asStr(raw.incident_id) ?? `den-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const killed = asNum(raw.fatalities) ?? asNum(raw.fatality_1) ?? 0
  const seriousInjury = asNum(raw.seriously_) ?? asNum(raw.seriously_injured) ?? 0

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `DEN-${incidentId}`,
    crashDate: parsedDate,
    county: 'DENVER',
    cityName: 'Denver',
    latitude: asNum(raw.geo_lat),
    longitude: asNum(raw.geo_lon),
    crashSeverity: killed > 0 ? 'FATAL' : seriousInjury > 0 ? 'SUSPECTED_SERIOUS_INJURY' : 'PROPERTY_DAMAGE_ONLY',
    stateCode: 'CO',
    dataSource: 'socrata-denver',
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Parse Colorado Springs Traffic Crashes (dataset bjpt-tkzq).
 */
function parseColoradoSpringsRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  // CO Springs uses accidentdatetime, not crash_date
  const dateStr = asStr(raw.accidentdatetime) ?? asStr(raw.crash_date) ?? asStr(raw.date_reported) ?? asStr(raw.reported_date)
  if (!dateStr) return null

  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  const crashId = asStr(raw.accidentnumber) ?? asStr(raw.case_number) ?? asStr(raw.crash_id) ?? `cos-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const killed = asNum(raw.numberofkilled) ?? 0
  const injured = asNum(raw.numberofinjured) ?? 0

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `COS-${crashId}`,
    crashDate: parsedDate,
    county: 'EL PASO',
    cityName: 'Colorado Springs',
    latitude: asNum(raw.latitude) ?? asNum(raw.geo_lat),
    longitude: asNum(raw.longitude) ?? asNum(raw.geo_lon),
    crashSeverity: killed > 0 ? 'FATAL' : injured > 0 ? 'SUSPECTED_MINOR_INJURY' : mapSeverity(raw.severity) ?? 'PROPERTY_DAMAGE_ONLY',
    stateCode: 'CO',
    dataSource: 'socrata-colorado-springs',
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Parse Los Angeles Traffic Collisions (dataset d5tf-ez2w).
 * Fields: dr_no, date_occ, time_occ, area_name, location, lat, lon
 */
function parseLosAngelesRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  const dateStr = asStr(raw.date_occ) ?? asStr(raw.date_rptd)
  if (!dateStr) return null

  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  const drNo = asStr(raw.dr_no) ?? `la-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  // LA has location_1 as {latitude, longitude} object, not top-level lat/lon
  const loc = raw.location_1 as { latitude?: string; longitude?: string } | undefined
  const lat = asNum(raw.lat) ?? asNum(loc?.latitude)
  const lon = asNum(raw.lon) ?? asNum(loc?.longitude)

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `LA-${drNo}`,
    crashDate: parsedDate,
    crashTime: asStr(raw.time_occ),
    county: 'LOS ANGELES',
    cityName: 'Los Angeles',
    latitude: lat,
    longitude: lon,
    stateCode: 'CA',
    dataSource: 'socrata-los-angeles',
    crashSeverity: 'PROPERTY_DAMAGE_ONLY',
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Parse San Francisco Traffic Crashes (dataset ubvf-ztfx).
 * Fields: case_id, collision_date, collision_time, weather_1, lighting, latitude, longitude
 */
function parseSanFranciscoRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  const dateStr = asStr(raw.collision_date) ?? asStr(raw.accident_date)
  if (!dateStr) return null

  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  const caseId = asStr(raw.case_id_pkey) ?? asStr(raw.case_id) ?? asStr(raw.unique_id) ?? `sf-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`
  const killed = asNum(raw.number_killed) ?? asNum(raw.killed_victims) ?? 0
  const injured = asNum(raw.number_injured) ?? asNum(raw.injured_victims) ?? 0

  // SF has tb_latitude/tb_longitude and point geometry
  const pointCoords = (raw.point as { coordinates?: number[] })?.coordinates
  const crash: Partial<CrashSilver> = {
    stateUniqueId: `SF-${caseId}`,
    crashDate: parsedDate,
    crashTime: asStr(raw.collision_time),
    county: 'SAN FRANCISCO',
    cityName: 'San Francisco',
    latitude: asNum(raw.tb_latitude) ?? asNum(raw.latitude) ?? asNum(pointCoords?.[1]),
    longitude: asNum(raw.tb_longitude) ?? asNum(raw.longitude) ?? asNum(pointCoords?.[0]),
    crashSeverity: killed > 0 ? 'FATAL' : injured > 0 ? 'SUSPECTED_MINOR_INJURY' : 'PROPERTY_DAMAGE_ONLY',
    atmosphericCondition: mapWeather(raw.weather_1),
    lightCondition: mapLight(raw.lighting),
    stateCode: 'CA',
    dataSource: 'socrata-san-francisco',
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Generic fallback parser for unknown Socrata datasets.
 * Tries common field names to extract crash data.
 */
function parseGenericSocrataRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const raw = bronze.rawData

  // Try common date fields
  const dateStr = asStr(raw.crash_date) ?? asStr(raw.date) ?? asStr(raw.collision_date) ?? asStr(raw.reported_date) ?? asStr(raw.date_occ)
  if (!dateStr) return null

  const parsedDate = new Date(dateStr)
  if (isNaN(parsedDate.getTime())) return null

  // Try common ID fields
  const uniqueId = asStr(raw.crash_id) ?? asStr(raw.case_id) ?? asStr(raw.incident_id) ?? asStr(raw.objectid) ?? `gen-${parsedDate.getTime()}-${Math.random().toString(36).slice(2, 8)}`

  const crash: Partial<CrashSilver> = {
    stateUniqueId: `${bronze.stateCode}-${uniqueId}`,
    crashDate: parsedDate,
    county: asStr(raw.county) ?? asStr(raw.county_name),
    cityName: asStr(raw.city) ?? asStr(raw.city_name),
    latitude: asNum(raw.latitude) ?? asNum(raw.lat),
    longitude: asNum(raw.longitude) ?? asNum(raw.lon) ?? asNum(raw.long),
    crashSeverity: mapSeverity(raw.severity) ?? mapSeverity(raw.crash_severity) ?? mapSeverity(raw.most_severe_injury) ?? 'PROPERTY_DAMAGE_ONLY',
    atmosphericCondition: mapWeather(raw.weather) ?? mapWeather(raw.weather_condition),
    lightCondition: mapLight(raw.lighting) ?? mapLight(raw.lighting_condition) ?? mapLight(raw.light_condition),
    stateCode: bronze.stateCode,
    dataSource: bronze.source,
  }

  return { crash, vehicles: [], persons: [] }
}

/**
 * Parse a Socrata BronzeRecord based on its source.
 * Routes to city-specific parser, falls back to generic.
 */
export function parseSocrataRecord(bronze: BronzeRecord): SocrataParsedResult | null {
  const source = bronze.source

  switch (source) {
    case 'socrata-nyc':
      return parseNYCRecord(bronze)
    case 'socrata-chicago':
      return parseChicagoRecord(bronze)
    case 'socrata-denver':
      return parseDenverRecord(bronze)
    case 'socrata-colorado-springs':
      return parseColoradoSpringsRecord(bronze)
    case 'socrata-los-angeles':
      return parseLosAngelesRecord(bronze)
    case 'socrata-san-francisco':
      return parseSanFranciscoRecord(bronze)
    default:
      // Try generic parser as fallback
      return parseGenericSocrataRecord(bronze)
  }
}
