import { describe, it, expect } from 'vitest'
import {
  generateSettlementContext,
  type CrashForSettlement,
} from '../services/equalizer/settlement-context'
import type { ComparableCohort } from '../services/equalizer/comparable-engine'
import type { LiabilitySignal } from '../services/equalizer/liability-signals'

function makeBaseCrash(overrides?: Partial<CrashForSettlement>): CrashForSettlement {
  return {
    crashSeverity: 'POSSIBLE_INJURY',
    stateCode: 'PA',
    vehicles: [{ bodyType: 'PASSENGER_CAR' }, { bodyType: 'PASSENGER_CAR' }],
    persons: [{ personType: 'DRIVER' }, { personType: 'DRIVER' }],
    ...overrides,
  }
}

function makeEmptyCohort(): ComparableCohort {
  return {
    count: 0,
    confidence: 'LOW',
    severityDistribution: {},
    avgVehicles: 0,
    injuryRate: 0,
    fatalityRate: 0,
    topContributingFactors: [],
    dateRange: { earliest: new Date(), latest: new Date() },
  }
}

describe('Settlement Context', () => {
  it('should return correct base range for PROPERTY_DAMAGE_ONLY', () => {
    const crash = makeBaseCrash({ crashSeverity: 'PROPERTY_DAMAGE_ONLY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.low).toBe(0)
    expect(result.range.mid).toBe(2500)
    expect(result.range.high).toBe(5000)
  })

  it('should return correct base range for POSSIBLE_INJURY', () => {
    const crash = makeBaseCrash({ crashSeverity: 'POSSIBLE_INJURY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.low).toBe(2000)
    expect(result.range.mid).toBe(10000)
    expect(result.range.high).toBe(25000)
  })

  it('should return correct base range for SUSPECTED_MINOR_INJURY', () => {
    const crash = makeBaseCrash({ crashSeverity: 'SUSPECTED_MINOR_INJURY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.low).toBe(5000)
    expect(result.range.mid).toBe(15000)
    expect(result.range.high).toBe(50000)
  })

  it('should return correct base range for SUSPECTED_SERIOUS_INJURY', () => {
    const crash = makeBaseCrash({ crashSeverity: 'SUSPECTED_SERIOUS_INJURY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.low).toBe(25000)
    expect(result.range.mid).toBe(75000)
    expect(result.range.high).toBe(250000)
  })

  it('should return correct base range for FATAL', () => {
    const crash = makeBaseCrash({ crashSeverity: 'FATAL' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.low).toBe(100000)
    expect(result.range.mid).toBe(500000)
    expect(result.range.high).toBe(2000000)
  })

  it('should apply multi-vehicle adjustment (+15%)', () => {
    const crash = makeBaseCrash({
      crashSeverity: 'POSSIBLE_INJURY',
      vehicles: [
        { bodyType: 'PASSENGER_CAR' },
        { bodyType: 'PASSENGER_CAR' },
        { bodyType: 'SUV' },
      ],
    })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    // 1.15x multiplier: 2000*1.15=2300, 10000*1.15=11500, 25000*1.15=28750
    expect(result.range.low).toBe(2300)
    expect(result.range.mid).toBe(11500)
    expect(result.range.high).toBe(28750)
    expect(result.factors).toContain('Multi-vehicle (>2): +15%')
  })

  it('should apply pedestrian adjustment (+25%)', () => {
    const crash = makeBaseCrash({
      crashSeverity: 'POSSIBLE_INJURY',
      persons: [{ personType: 'DRIVER' }, { personType: 'PEDESTRIAN' }],
    })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.mid).toBe(12500) // 10000 * 1.25
    expect(result.factors).toContain('Pedestrian involved: +25%')
  })

  it('should apply impaired driver adjustment (+30%)', () => {
    const signals: LiabilitySignal[] = [
      {
        signal: 'IMPAIRED_DRIVER',
        type: 'FAULT',
        confidence: 0.95,
        sourceField: 'suspectedAlcoholDrug',
        humanReadable: 'Impaired driver',
      },
    ]
    const crash = makeBaseCrash({ crashSeverity: 'POSSIBLE_INJURY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), signals)
    expect(result.range.mid).toBe(13000) // 10000 * 1.30
    expect(result.factors).toContain('Impaired driver: +30%')
  })

  it('should apply commercial vehicle adjustment (+40%)', () => {
    const crash = makeBaseCrash({
      crashSeverity: 'POSSIBLE_INJURY',
      vehicles: [{ bodyType: 'PASSENGER_CAR' }, { bodyType: 'TRUCK_TRACTOR' }],
    })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.range.mid).toBe(14000) // 10000 * 1.40
    expect(result.factors).toContain('Commercial vehicle: +40%')
  })

  it('should apply adverse weather adjustment (-10%)', () => {
    const signals: LiabilitySignal[] = [
      {
        signal: 'ADVERSE_WEATHER',
        type: 'ENVIRONMENTAL',
        confidence: 0.5,
        sourceField: 'atmosphericCondition',
        humanReadable: 'Adverse weather',
      },
    ]
    const crash = makeBaseCrash({ crashSeverity: 'POSSIBLE_INJURY' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), signals)
    expect(result.range.mid).toBe(9000) // 10000 * 0.90
    expect(result.factors).toContain('Adverse weather: -10%')
  })

  it('should stack multiple adjustments', () => {
    const signals: LiabilitySignal[] = [
      {
        signal: 'IMPAIRED_DRIVER',
        type: 'FAULT',
        confidence: 0.95,
        sourceField: 'suspectedAlcoholDrug',
        humanReadable: 'Impaired',
      },
    ]
    const crash = makeBaseCrash({
      crashSeverity: 'POSSIBLE_INJURY',
      persons: [{ personType: 'DRIVER' }, { personType: 'PEDESTRIAN' }],
    })
    // 1.0 + 0.25 (pedestrian) + 0.30 (impaired) = 1.55
    const result = generateSettlementContext(crash, makeEmptyCohort(), signals)
    expect(result.range.mid).toBe(15500) // 10000 * 1.55
    expect(result.factors).toHaveLength(2)
  })

  it('should include state factors for PA', () => {
    const crash = makeBaseCrash({ stateCode: 'PA' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.stateFactors.statuteOfLimitations).toBe('2 years')
    expect(result.stateFactors.faultType).toContain('Modified comparative (51%)')
  })

  it('should include state factors for CA (pure comparative)', () => {
    const crash = makeBaseCrash({ stateCode: 'CA' })
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.stateFactors.statuteOfLimitations).toBe('2 years')
    expect(result.stateFactors.faultType).toContain('Pure comparative fault')
  })

  it('should always include disclaimer', () => {
    const crash = makeBaseCrash()
    const result = generateSettlementContext(crash, makeEmptyCohort(), [])
    expect(result.disclaimer).toBe('This analysis is based on public crash data and is not legal advice.')
  })
})
