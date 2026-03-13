/**
 * ArcGIS endpoint configurations per state.
 * Each state DOT uses different field names and service URLs.
 */

export interface ArcGISFieldMapping {
  uniqueId: string
  crashDate: string
  crashTime?: string
  county?: string
  latitude?: string
  longitude?: string
  severity?: string
  mannerOfCollision?: string
  weather?: string
  lightCondition?: string
  cityName?: string
  streetAddress?: string
  vehicleCount?: string
}

export interface ArcGISStateMapping {
  stateCode: string
  name: string
  endpoint: string
  layerId: number
  dateField: string        // field used in date-range WHERE clause
  batchSize: number
  fieldMapping: ArcGISFieldMapping
  isActive: boolean
}

export const ARCGIS_STATE_CONFIGS: ArcGISStateMapping[] = [
  {
    stateCode: 'PA',
    name: 'Pennsylvania DOT',
    endpoint: 'https://gis.penndot.pa.gov/arcgis/rest/services/opendata/CrashData/FeatureServer',
    layerId: 0,
    dateField: 'CRASH_YEAR',
    batchSize: 2000,
    fieldMapping: {
      uniqueId: 'CRN',
      crashDate: 'CRASH_YEAR',
      county: 'COUNTY',
      latitude: 'DEC_LAT',
      longitude: 'DEC_LONG',
      severity: 'MAX_SEVERITY_LEVEL',
      mannerOfCollision: 'COLLISION_TYPE',
      weather: 'WEATHER',
      lightCondition: 'ILLUMINATION',
      cityName: 'MUNICIPALITY',
    },
    isActive: true,
  },
  {
    stateCode: 'CO',
    name: 'Colorado DOT (Denver Open Data)',
    endpoint: 'https://services1.arcgis.com/Ezk9fcjSUKMTmXGa/arcgis/rest/services',
    layerId: 0,
    dateField: 'FIRST_HARMFUL_EVT_DTM',
    batchSize: 2000,
    fieldMapping: {
      uniqueId: 'OBJECTID',
      crashDate: 'FIRST_HARMFUL_EVT_DTM',
      county: 'COUNTY_DESC',
      latitude: 'LATITUDE',
      longitude: 'LONGITUDE',
      severity: 'HIGHEST_INJURY_SVRTY_CODE',
      mannerOfCollision: 'CRASH_TYPE_CODE',
      weather: 'WEATHER_CONDITION_CODE',
      lightCondition: 'LIGHTING_CONDITION_CODE',
      cityName: 'CITY',
    },
    isActive: false, // Needs specific service name in endpoint
  },
  {
    stateCode: 'IL',
    name: 'Illinois DOT',
    endpoint: 'https://gis.dot.illinois.gov/arcgis/rest/services/',
    layerId: 0,
    dateField: 'date_of_crash',
    batchSize: 2000,
    fieldMapping: {
      uniqueId: 'CASENUMBER',
      crashDate: 'date_of_crash',
      county: 'county_name',
      latitude: 'latitude',
      longitude: 'longitude',
      severity: 'most_severe_injury',
      mannerOfCollision: 'manner_of_crash',
      weather: 'weather_cond_1',
      lightCondition: 'lighting_cond',
    },
    isActive: false, // Needs specific service name in endpoint
  },
  {
    stateCode: 'MA',
    name: 'Massachusetts DOT',
    endpoint: 'https://geo-massdot.opendata.arcgis.com/',
    layerId: 0,
    dateField: 'CRASH_DATE',
    batchSize: 2000,
    fieldMapping: {
      uniqueId: 'CRASH_NUMB',
      crashDate: 'CRASH_DATE',
      county: 'CNTY_NAME',
      latitude: 'LAT',
      longitude: 'LON',
      severity: 'CRASH_SEVERITY',
      weather: 'WEATH_COND',
      lightCondition: 'ROAD_COND',
    },
    isActive: false,
  },
  {
    stateCode: 'WA',
    name: 'Washington DOT',
    endpoint: 'https://data.wsdot.wa.gov/',
    layerId: 0,
    dateField: 'AccidentDate',
    batchSize: 2000,
    fieldMapping: {
      uniqueId: 'ReportNumber',
      crashDate: 'AccidentDate',
      county: 'County',
      latitude: 'Latitude',
      longitude: 'Longitude',
      severity: 'MostSevereInjury',
      weather: 'Weather',
      lightCondition: 'LightCondition',
      cityName: 'City',
    },
    isActive: false,
  },
]

/** Get config by state code */
export function getArcGISConfig(stateCode: string): ArcGISStateMapping | undefined {
  return ARCGIS_STATE_CONFIGS.find(c => c.stateCode === stateCode)
}

/** Get all active configs */
export function getActiveArcGISConfigs(): ArcGISStateMapping[] {
  return ARCGIS_STATE_CONFIGS.filter(c => c.isActive)
}
