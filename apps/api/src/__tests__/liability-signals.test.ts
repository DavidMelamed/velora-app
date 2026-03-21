import { describe, it, expect } from 'vitest'
import { extractLiabilitySignals, type CrashForLiability } from '../services/equalizer/liability-signals'

function makeBaseCrash(overrides?: Partial<CrashForLiability>): CrashForLiability {
  return {
    mannerOfCollision: null,
    crashRelatedFactors: [],
    atmosphericCondition: null,
    lightCondition: null,
    workZone: null,
    vehicles: [
      {
        bodyType: 'PASSENGER_CAR',
        contributingCircumstances: [],
        driver: {
          suspectedAlcoholDrug: false,
          driverActions: [],
        },
      },
    ],
    persons: [{ personType: 'DRIVER' }],
    ...overrides,
  }
}

describe('Liability Signals', () => {
  it('Rule 1: should detect rear-end collision (FRONT_TO_REAR)', () => {
    const crash = makeBaseCrash({ mannerOfCollision: 'FRONT_TO_REAR' })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('REAR_END_COLLISION')
    expect(signals[0].type).toBe('FAULT')
    expect(signals[0].confidence).toBe(0.85)
  })

  it('Rule 2: should detect traffic signal violation', () => {
    const crash = makeBaseCrash({ crashRelatedFactors: ['SIGNAL_VIOLATION'] })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('SIGNAL_VIOLATION')
    expect(signals[0].confidence).toBe(0.9)
  })

  it('Rule 3: should detect following too close', () => {
    const crash = makeBaseCrash({
      vehicles: [
        {
          bodyType: 'PASSENGER_CAR',
          contributingCircumstances: ['FOLLOWING_TOO_CLOSE'],
          driver: { suspectedAlcoholDrug: false, driverActions: [] },
        },
      ],
    })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('FOLLOWING_TOO_CLOSE')
    expect(signals[0].confidence).toBe(0.8)
  })

  it('Rule 4: should detect impaired driver', () => {
    const crash = makeBaseCrash({
      vehicles: [
        {
          bodyType: 'PASSENGER_CAR',
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: true, driverActions: [] },
        },
      ],
    })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('IMPAIRED_DRIVER')
    expect(signals[0].confidence).toBe(0.95)
  })

  it('Rule 5: should detect adverse weather', () => {
    const crash = makeBaseCrash({ atmosphericCondition: 'RAIN' })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('ADVERSE_WEATHER')
    expect(signals[0].type).toBe('ENVIRONMENTAL')
    expect(signals[0].confidence).toBe(0.5)
  })

  it('Rule 5: should detect SNOW as adverse weather', () => {
    const crash = makeBaseCrash({ atmosphericCondition: 'SNOW' })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('ADVERSE_WEATHER')
  })

  it('Rule 6: should detect dark unlighted road', () => {
    const crash = makeBaseCrash({ lightCondition: 'DARK_NOT_LIGHTED' })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('DARK_UNLIGHTED_ROAD')
    expect(signals[0].type).toBe('INFRASTRUCTURE')
    expect(signals[0].confidence).toBe(0.6)
  })

  it('Rule 7: should detect work zone', () => {
    const crash = makeBaseCrash({ workZone: { present: true, type: 'CONSTRUCTION' } })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(1)
    expect(signals[0].signal).toBe('WORK_ZONE')
    expect(signals[0].type).toBe('SHARED')
    expect(signals[0].confidence).toBe(0.55)
  })

  it('should detect multiple signals in one crash', () => {
    const crash = makeBaseCrash({
      mannerOfCollision: 'FRONT_TO_REAR',
      atmosphericCondition: 'RAIN',
      vehicles: [
        {
          bodyType: 'PASSENGER_CAR',
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: true, driverActions: [] },
        },
      ],
    })
    const signals = extractLiabilitySignals(crash)
    expect(signals.length).toBe(3)
    // Should be sorted by confidence descending
    expect(signals[0].confidence).toBeGreaterThanOrEqual(signals[1].confidence)
    expect(signals[1].confidence).toBeGreaterThanOrEqual(signals[2].confidence)
  })

  it('should return empty array when no rules match', () => {
    const crash = makeBaseCrash({
      mannerOfCollision: 'ANGLE',
      atmosphericCondition: 'CLEAR',
      lightCondition: 'DAYLIGHT',
    })
    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(0)
  })
})
