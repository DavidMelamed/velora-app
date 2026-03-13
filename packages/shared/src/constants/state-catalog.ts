/**
 * Complete US state catalog with legal/geo metadata.
 * 50 states + DC. FIPS codes from US Census Bureau.
 * Statute of limitations and fault types verified against state law.
 */

export type FaultType = 'PURE_COMPARATIVE' | 'MODIFIED_50' | 'MODIFIED_51' | 'CONTRIBUTORY'

export interface StateConfig {
  code: string           // 2-letter
  fips: string           // 2-digit FIPS
  name: string
  statuteOfLimitationsYears: number
  faultType: FaultType
  dataSources: {
    fars: boolean        // always true — FARS covers all states
    arcgis?: string      // endpoint URL if available
    socrata?: string     // dataset ID if available
    cdot?: boolean       // special case for Colorado
  }
}

export const STATE_CATALOG: StateConfig[] = [
  { code: 'AL', fips: '01', name: 'Alabama', statuteOfLimitationsYears: 2, faultType: 'CONTRIBUTORY', dataSources: { fars: true } },
  { code: 'AK', fips: '02', name: 'Alaska', statuteOfLimitationsYears: 2, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'AZ', fips: '04', name: 'Arizona', statuteOfLimitationsYears: 2, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'AR', fips: '05', name: 'Arkansas', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'CA', fips: '06', name: 'California', statuteOfLimitationsYears: 2, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'CO', fips: '08', name: 'Colorado', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_50', dataSources: { fars: true, cdot: true, arcgis: 'https://services1.arcgis.com/Ezk9fcjSUKMTmXGa/arcgis/rest/services' } },
  { code: 'CT', fips: '09', name: 'Connecticut', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'DE', fips: '10', name: 'Delaware', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'FL', fips: '12', name: 'Florida', statuteOfLimitationsYears: 4, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'GA', fips: '13', name: 'Georgia', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'HI', fips: '15', name: 'Hawaii', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'ID', fips: '16', name: 'Idaho', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'IL', fips: '17', name: 'Illinois', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_50', dataSources: { fars: true, arcgis: 'https://gis.dot.illinois.gov/arcgis/rest/services/' } },
  { code: 'IN', fips: '18', name: 'Indiana', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'IA', fips: '19', name: 'Iowa', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'KS', fips: '20', name: 'Kansas', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'KY', fips: '21', name: 'Kentucky', statuteOfLimitationsYears: 1, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'LA', fips: '22', name: 'Louisiana', statuteOfLimitationsYears: 1, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'ME', fips: '23', name: 'Maine', statuteOfLimitationsYears: 6, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'MD', fips: '24', name: 'Maryland', statuteOfLimitationsYears: 3, faultType: 'CONTRIBUTORY', dataSources: { fars: true } },
  { code: 'MA', fips: '25', name: 'Massachusetts', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true, arcgis: 'https://geo-massdot.opendata.arcgis.com/' } },
  { code: 'MI', fips: '26', name: 'Michigan', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'MN', fips: '27', name: 'Minnesota', statuteOfLimitationsYears: 6, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'MS', fips: '28', name: 'Mississippi', statuteOfLimitationsYears: 3, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'MO', fips: '29', name: 'Missouri', statuteOfLimitationsYears: 5, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'MT', fips: '30', name: 'Montana', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'NE', fips: '31', name: 'Nebraska', statuteOfLimitationsYears: 4, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'NV', fips: '32', name: 'Nevada', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'NH', fips: '33', name: 'New Hampshire', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'NJ', fips: '34', name: 'New Jersey', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'NM', fips: '35', name: 'New Mexico', statuteOfLimitationsYears: 3, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'NY', fips: '36', name: 'New York', statuteOfLimitationsYears: 3, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true, socrata: 'h9gi-nx95' } },
  { code: 'NC', fips: '37', name: 'North Carolina', statuteOfLimitationsYears: 3, faultType: 'CONTRIBUTORY', dataSources: { fars: true } },
  { code: 'ND', fips: '38', name: 'North Dakota', statuteOfLimitationsYears: 6, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'OH', fips: '39', name: 'Ohio', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'OK', fips: '40', name: 'Oklahoma', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'OR', fips: '41', name: 'Oregon', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'PA', fips: '42', name: 'Pennsylvania', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true, arcgis: 'https://gis.penndot.pa.gov/arcgis/rest/services/opendata/CrashData/FeatureServer' } },
  { code: 'RI', fips: '44', name: 'Rhode Island', statuteOfLimitationsYears: 3, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true } },
  { code: 'SC', fips: '45', name: 'South Carolina', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'SD', fips: '46', name: 'South Dakota', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'TN', fips: '47', name: 'Tennessee', statuteOfLimitationsYears: 1, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'TX', fips: '48', name: 'Texas', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'UT', fips: '49', name: 'Utah', statuteOfLimitationsYears: 4, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'VT', fips: '50', name: 'Vermont', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'VA', fips: '51', name: 'Virginia', statuteOfLimitationsYears: 2, faultType: 'CONTRIBUTORY', dataSources: { fars: true } },
  { code: 'WA', fips: '53', name: 'Washington', statuteOfLimitationsYears: 3, faultType: 'PURE_COMPARATIVE', dataSources: { fars: true, arcgis: 'https://data.wsdot.wa.gov/' } },
  { code: 'WV', fips: '54', name: 'West Virginia', statuteOfLimitationsYears: 2, faultType: 'MODIFIED_50', dataSources: { fars: true } },
  { code: 'WI', fips: '55', name: 'Wisconsin', statuteOfLimitationsYears: 3, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'WY', fips: '56', name: 'Wyoming', statuteOfLimitationsYears: 4, faultType: 'MODIFIED_51', dataSources: { fars: true } },
  { code: 'DC', fips: '11', name: 'District of Columbia', statuteOfLimitationsYears: 3, faultType: 'CONTRIBUTORY', dataSources: { fars: true } },
]

/** Lookup map by state code */
export const STATE_BY_CODE: Record<string, StateConfig> = Object.fromEntries(
  STATE_CATALOG.map(s => [s.code, s])
)

/** Lookup map by FIPS code */
export const STATE_BY_FIPS: Record<string, StateConfig> = Object.fromEntries(
  STATE_CATALOG.map(s => [s.fips, s])
)

export const ALL_STATE_CODES = STATE_CATALOG.map(s => s.code)

export const CONTRIBUTORY_STATES = STATE_CATALOG.filter(s => s.faultType === 'CONTRIBUTORY').map(s => s.code)
export const PURE_COMPARATIVE_STATES = STATE_CATALOG.filter(s => s.faultType === 'PURE_COMPARATIVE').map(s => s.code)
export const MODIFIED_50_STATES = STATE_CATALOG.filter(s => s.faultType === 'MODIFIED_50').map(s => s.code)
export const MODIFIED_51_STATES = STATE_CATALOG.filter(s => s.faultType === 'MODIFIED_51').map(s => s.code)
