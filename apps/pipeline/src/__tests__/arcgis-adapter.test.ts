import { describe, it, expect } from 'vitest'
import { parseArcGISRecord } from '../silver/parsers/arcgis-parser'
import type { BronzeRecord } from '../bronze/types'
import type { ArcGISStateMapping } from '../config/arcgis-states'

const PA_MAPPING: ArcGISStateMapping = {
  stateCode: 'PA',
  name: 'Pennsylvania DOT',
  endpoint: 'https://example.com/arcgis',
  layerId: 0,
  dateField: 'CRASH_YEAR',
  batchSize: 2000,
  fieldMapping: {
    uniqueId: 'CRN',
    crashDate: 'CRASH_DATE',
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
}

describe('ArcGIS Parser', () => {
  it('should parse a PA crash record', () => {
    const bronze: BronzeRecord = {
      source: 'arcgis-pa',
      stateCode: 'PA',
      fetchedAt: new Date(),
      rawData: {
        CRN: 202200012345,
        CRASH_DATE: 1655251200000, // epoch ms for 2022-06-15
        COUNTY: 'Philadelphia',
        DEC_LAT: 39.9526,
        DEC_LONG: -75.1652,
        MAX_SEVERITY_LEVEL: 'Property Damage Only',
        COLLISION_TYPE: 'Rear-end',
        WEATHER: 'Clear',
        ILLUMINATION: 'Daylight',
        MUNICIPALITY: 'Philadelphia',
      },
    }

    const result = parseArcGISRecord(bronze, PA_MAPPING)
    expect(result).not.toBeNull()
    expect(result!.crash.stateUniqueId).toBe('ARCGIS-PA-202200012345')
    expect(result!.crash.stateCode).toBe('PA')
    expect(result!.crash.county).toBe('Philadelphia')
    expect(result!.crash.latitude).toBe(39.9526)
    expect(result!.crash.longitude).toBe(-75.1652)
    expect(result!.crash.crashSeverity).toBe('PROPERTY_DAMAGE_ONLY')
    expect(result!.crash.atmosphericCondition).toBe('CLEAR')
    expect(result!.crash.lightCondition).toBe('DAYLIGHT')
    expect(result!.crash.mannerOfCollision).toBe('FRONT_TO_REAR')
    expect(result!.crash.dataSource).toBe('ARCGIS-PA')
  })

  it('should extract coordinates from geometry object', () => {
    const bronze: BronzeRecord = {
      source: 'arcgis-pa',
      stateCode: 'PA',
      fetchedAt: new Date(),
      rawData: {
        CRN: 202200067890,
        CRASH_DATE: 1655251200000,
        _geometry: { x: -75.1652, y: 39.9526 },
      },
    }

    const result = parseArcGISRecord(bronze, PA_MAPPING)
    expect(result).not.toBeNull()
    expect(result!.crash.latitude).toBe(39.9526)
    expect(result!.crash.longitude).toBe(-75.1652)
  })

  it('should return null for record without unique ID', () => {
    const bronze: BronzeRecord = {
      source: 'arcgis-pa',
      stateCode: 'PA',
      fetchedAt: new Date(),
      rawData: {
        CRASH_DATE: 1655251200000,
        COUNTY: 'Philadelphia',
      },
    }

    const result = parseArcGISRecord(bronze, PA_MAPPING)
    expect(result).toBeNull()
  })

  it('should return null for record without valid date', () => {
    const bronze: BronzeRecord = {
      source: 'arcgis-pa',
      stateCode: 'PA',
      fetchedAt: new Date(),
      rawData: {
        CRN: 202200099999,
        COUNTY: 'Philadelphia',
      },
    }

    const result = parseArcGISRecord(bronze, PA_MAPPING)
    expect(result).toBeNull()
  })

  it('should map severity string variations correctly', () => {
    const testCases = [
      { input: 'Fatal', expected: 'FATAL' },
      { input: 'Suspected Serious Injury', expected: 'SUSPECTED_SERIOUS_INJURY' },
      { input: 'Suspected Minor Injury', expected: 'SUSPECTED_MINOR_INJURY' },
      { input: 'Possible Injury', expected: 'POSSIBLE_INJURY' },
      { input: 'Property Damage Only', expected: 'PROPERTY_DAMAGE_ONLY' },
      { input: 'PDO', expected: 'PROPERTY_DAMAGE_ONLY' },
    ]

    for (const tc of testCases) {
      const bronze: BronzeRecord = {
        source: 'arcgis-pa',
        stateCode: 'PA',
        fetchedAt: new Date(),
        rawData: {
          CRN: `STEST${Math.random()}`,
          CRASH_DATE: 1655251200000,
          MAX_SEVERITY_LEVEL: tc.input,
        },
      }
      const result = parseArcGISRecord(bronze, PA_MAPPING)
      expect(result).not.toBeNull()
      expect(result!.crash.crashSeverity).toBe(tc.expected)
    }
  })
})
