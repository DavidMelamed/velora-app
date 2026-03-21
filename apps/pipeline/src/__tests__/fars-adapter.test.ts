import { describe, it, expect } from 'vitest'
import { parseFARSRecord } from '../silver/parsers/fars-parser'
import type { BronzeRecord } from '../bronze/types'

describe('FARS Parser', () => {
  it('should parse a minimal FARS accident record', () => {
    const bronze: BronzeRecord = {
      source: 'fars',
      stateCode: 'CO',
      fetchedAt: new Date(),
      rawData: {
        Results: [[{
          ST_CASE: 80001,
          STATE: 8,
          YEAR: 2022,
          MONTH: 6,
          DAY: 15,
          HOUR: 14,
          MINUTE: 30,
          COUNTY: 31,
          COUNTYNAME: 'Denver',
          LATITUDE: 39.7392,
          LONGITUD: -104.9903,
          MAN_COLL: 6,
          WEATHER: 1,
          LGT_COND: 1,
          FATALS: 1,
        }]],
      },
    }

    const result = parseFARSRecord(bronze)
    expect(result).not.toBeNull()
    expect(result!.crash.stateUniqueId).toBe('FARS-CO-2022-80001')
    expect(result!.crash.crashSeverity).toBe('FATAL')
    expect(result!.crash.stateCode).toBe('CO')
    expect(result!.crash.county).toBe('Denver')
    expect(result!.crash.latitude).toBe(39.7392)
    expect(result!.crash.longitude).toBe(-104.9903)
    expect(result!.crash.mannerOfCollision).toBe('ANGLE')
    expect(result!.crash.atmosphericCondition).toBe('CLEAR')
    expect(result!.crash.lightCondition).toBe('DAYLIGHT')
    expect(result!.crash.dataSource).toBe('FARS')
  })

  it('should parse vehicles from FARS response', () => {
    const bronze: BronzeRecord = {
      source: 'fars',
      stateCode: 'CO',
      fetchedAt: new Date(),
      rawData: {
        Results: [[{
          ST_CASE: 80002,
          STATE: 8,
          YEAR: 2022,
          MONTH: 3,
          DAY: 10,
        }]],
        VEHICLEs: [
          { MAKENAME: 'Toyota', MOD_YEAR: 2020, MODELNAME: 'Camry', SP_LIMIT: 55, HIT_RUN: 0 },
          { MAKENAME: 'Honda', MOD_YEAR: 2019, MODELNAME: 'Civic', SP_LIMIT: 55, HIT_RUN: 0 },
        ],
      },
    }

    const result = parseFARSRecord(bronze)
    expect(result).not.toBeNull()
    expect(result!.vehicles).toHaveLength(2)
    expect(result!.vehicles[0].make).toBe('Toyota')
    expect(result!.vehicles[0].modelYear).toBe(2020)
    expect(result!.vehicles[1].make).toBe('Honda')
  })

  it('should parse persons from FARS response', () => {
    const bronze: BronzeRecord = {
      source: 'fars',
      stateCode: 'CO',
      fetchedAt: new Date(),
      rawData: {
        Results: [[{
          ST_CASE: 80003,
          STATE: 8,
          YEAR: 2022,
          MONTH: 7,
          DAY: 4,
        }]],
        PERSONs: [
          { PER_TYP: 1, INJ_SEV: 4, SEX: 1 },
          { PER_TYP: 2, INJ_SEV: 3, SEX: 2 },
        ],
      },
    }

    const result = parseFARSRecord(bronze)
    expect(result).not.toBeNull()
    expect(result!.persons).toHaveLength(2)
    expect(result!.persons[0].personType).toBe('DRIVER')
    expect(result!.persons[0].injuryStatus).toBe('FATAL')
    expect(result!.persons[0].sex).toBe('MALE')
    expect(result!.persons[1].personType).toBe('PASSENGER')
    expect(result!.persons[1].injuryStatus).toBe('SUSPECTED_SERIOUS')
  })

  it('should return null for record without ST_CASE', () => {
    const bronze: BronzeRecord = {
      source: 'fars',
      stateCode: 'CO',
      fetchedAt: new Date(),
      rawData: { Results: [[{ STATE: 8 }]] },
    }

    const result = parseFARSRecord(bronze)
    expect(result).toBeNull()
  })

  it('should handle empty Results array', () => {
    const bronze: BronzeRecord = {
      source: 'fars',
      stateCode: 'CO',
      fetchedAt: new Date(),
      rawData: { Results: [] },
    }

    const result = parseFARSRecord(bronze)
    expect(result).toBeNull()
  })
})
