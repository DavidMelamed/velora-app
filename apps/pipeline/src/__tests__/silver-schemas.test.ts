import { describe, it, expect } from 'vitest'
import { CrashSilverSchema, VehicleSilverSchema, PersonSilverSchema } from '../silver/schemas'

describe('Silver Schemas', () => {
  describe('CrashSilverSchema', () => {
    it('should validate a minimal crash record', () => {
      const result = CrashSilverSchema.safeParse({
        stateUniqueId: 'CO-2024-001',
        crashDate: '2024-01-15T00:00:00Z',
        stateCode: 'CO',
        dataSource: 'fars',
      })
      expect(result.success).toBe(true)
    })

    it('should validate a full crash record', () => {
      const result = CrashSilverSchema.safeParse({
        stateUniqueId: 'CO-2024-002',
        crashDate: '2024-06-20T14:30:00Z',
        crashTime: '14:30',
        county: 'Denver',
        latitude: 39.7392,
        longitude: -104.9903,
        mannerOfCollision: 'FRONT_TO_REAR',
        atmosphericCondition: 'CLEAR',
        lightCondition: 'DAYLIGHT',
        crashSeverity: 'PROPERTY_DAMAGE_ONLY',
        stateCode: 'CO',
        dataSource: 'arcgis-co',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid state code', () => {
      const result = CrashSilverSchema.safeParse({
        stateUniqueId: 'X-001',
        crashDate: '2024-01-15',
        stateCode: 'INVALID',
        dataSource: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('should reject latitude out of range', () => {
      const result = CrashSilverSchema.safeParse({
        stateUniqueId: 'CO-001',
        crashDate: '2024-01-15',
        stateCode: 'CO',
        dataSource: 'test',
        latitude: 999,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('VehicleSilverSchema', () => {
    it('should validate a vehicle record', () => {
      const result = VehicleSilverSchema.safeParse({
        make: 'Toyota',
        modelYear: 2022,
        model: 'Camry',
        bodyType: 'PASSENGER_CAR',
        speedLimit: 55,
        hitAndRun: false,
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid model year', () => {
      const result = VehicleSilverSchema.safeParse({
        modelYear: 1800,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('PersonSilverSchema', () => {
    it('should validate a person record', () => {
      const result = PersonSilverSchema.safeParse({
        personType: 'DRIVER',
        injuryStatus: 'NO_APPARENT_INJURY',
        sex: 'MALE',
      })
      expect(result.success).toBe(true)
    })

    it('should require personType', () => {
      const result = PersonSilverSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})
