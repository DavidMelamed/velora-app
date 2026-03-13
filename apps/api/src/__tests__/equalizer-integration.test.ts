import { describe, it, expect } from 'vitest'
import { extractLiabilitySignals } from '../services/equalizer/liability-signals'
import { generateSettlementContext } from '../services/equalizer/settlement-context'
import type { ComparableCohort } from '../services/equalizer/comparable-engine'

/**
 * Integration test: verifies the Equalizer orchestration flow
 * without hitting the database. Tests that liability signals feed
 * correctly into settlement context, which is the core pipeline.
 */
describe('Equalizer Integration', () => {
  it('should correctly pipe liability signals into settlement context', () => {
    // A serious rear-end crash with impairment in rain
    const crash = {
      mannerOfCollision: 'FRONT_TO_REAR' as const,
      crashRelatedFactors: [],
      atmosphericCondition: 'RAIN' as const,
      lightCondition: 'DAYLIGHT' as const,
      workZone: null,
      crashSeverity: 'SUSPECTED_SERIOUS_INJURY',
      stateCode: 'CA',
      vehicles: [
        {
          bodyType: 'PASSENGER_CAR' as const,
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: true, driverActions: [] },
        },
        {
          bodyType: 'PASSENGER_CAR' as const,
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: false, driverActions: [] },
        },
      ],
      persons: [{ personType: 'DRIVER' }, { personType: 'DRIVER' }],
    }

    // Step 1: Extract signals
    const signals = extractLiabilitySignals(crash)
    expect(signals.length).toBe(3) // rear-end, impaired, adverse weather

    const signalNames = signals.map((s) => s.signal)
    expect(signalNames).toContain('REAR_END_COLLISION')
    expect(signalNames).toContain('IMPAIRED_DRIVER')
    expect(signalNames).toContain('ADVERSE_WEATHER')

    // Step 2: Generate settlement context using those signals
    const cohort: ComparableCohort = {
      count: 45,
      confidence: 'MEDIUM',
      severityDistribution: { SUSPECTED_SERIOUS_INJURY: 30, FATAL: 15 },
      avgVehicles: 2.1,
      injuryRate: 0.82,
      fatalityRate: 0.12,
      topContributingFactors: ['SPEEDING', 'IMPAIRED'],
      dateRange: { earliest: new Date('2024-01-01'), latest: new Date('2025-12-01') },
    }

    const settlement = generateSettlementContext(
      {
        crashSeverity: crash.crashSeverity,
        stateCode: crash.stateCode,
        vehicles: crash.vehicles.map((v) => ({ bodyType: v.bodyType })),
        persons: crash.persons,
      },
      cohort,
      signals
    )

    // Base: 25000 / 75000 / 250000 for SUSPECTED_SERIOUS_INJURY
    // Adjustments: +30% impaired, -10% weather = +20% = 1.20x
    expect(settlement.range.low).toBe(30000)   // 25000 * 1.20
    expect(settlement.range.mid).toBe(90000)   // 75000 * 1.20
    expect(settlement.range.high).toBe(300000) // 250000 * 1.20

    // CA = pure comparative
    expect(settlement.stateFactors.faultType).toContain('Pure comparative')
    expect(settlement.stateFactors.statuteOfLimitations).toBe('2 years')

    expect(settlement.disclaimer).toBeTruthy()
    expect(settlement.factors).toHaveLength(2)
  })

  it('should handle a no-signal PDO crash', () => {
    const crash = {
      mannerOfCollision: 'ANGLE' as const,
      crashRelatedFactors: [],
      atmosphericCondition: 'CLEAR' as const,
      lightCondition: 'DAYLIGHT' as const,
      workZone: null,
      crashSeverity: 'PROPERTY_DAMAGE_ONLY',
      stateCode: 'TX',
      vehicles: [
        {
          bodyType: 'PASSENGER_CAR' as const,
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: false, driverActions: [] },
        },
        {
          bodyType: 'PASSENGER_CAR' as const,
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: false, driverActions: [] },
        },
      ],
      persons: [{ personType: 'DRIVER' }, { personType: 'DRIVER' }],
    }

    const signals = extractLiabilitySignals(crash)
    expect(signals).toHaveLength(0)

    const cohort: ComparableCohort = {
      count: 100,
      confidence: 'HIGH',
      severityDistribution: { PROPERTY_DAMAGE_ONLY: 100 },
      avgVehicles: 2,
      injuryRate: 0,
      fatalityRate: 0,
      topContributingFactors: [],
      dateRange: { earliest: new Date('2024-01-01'), latest: new Date('2025-12-01') },
    }

    const settlement = generateSettlementContext(
      {
        crashSeverity: crash.crashSeverity,
        stateCode: crash.stateCode,
        vehicles: crash.vehicles.map((v) => ({ bodyType: v.bodyType })),
        persons: crash.persons,
      },
      cohort,
      signals
    )

    // No adjustments, base PDO range
    expect(settlement.range.low).toBe(0)
    expect(settlement.range.mid).toBe(2500)
    expect(settlement.range.high).toBe(5000)
    expect(settlement.factors).toHaveLength(0)
  })

  it('should handle a fatal crash with commercial vehicle and pedestrian', () => {
    const crash = {
      mannerOfCollision: 'NOT_COLLISION_WITH_MV' as const,
      crashRelatedFactors: [],
      atmosphericCondition: 'CLEAR' as const,
      lightCondition: 'DARK_NOT_LIGHTED' as const,
      workZone: null,
      crashSeverity: 'FATAL',
      stateCode: 'MD',
      vehicles: [
        {
          bodyType: 'TRUCK_TRACTOR' as const,
          contributingCircumstances: [],
          driver: { suspectedAlcoholDrug: false, driverActions: [] },
        },
      ],
      persons: [{ personType: 'DRIVER' }, { personType: 'PEDESTRIAN' }],
    }

    const signals = extractLiabilitySignals(crash)
    expect(signals.length).toBe(1) // dark unlighted
    expect(signals[0].signal).toBe('DARK_UNLIGHTED_ROAD')

    const settlement = generateSettlementContext(
      {
        crashSeverity: crash.crashSeverity,
        stateCode: crash.stateCode,
        vehicles: crash.vehicles.map((v) => ({ bodyType: v.bodyType })),
        persons: crash.persons,
      },
      {
        count: 10,
        confidence: 'LOW',
        severityDistribution: { FATAL: 10 },
        avgVehicles: 1,
        injuryRate: 1,
        fatalityRate: 1,
        topContributingFactors: [],
        dateRange: { earliest: new Date(), latest: new Date() },
      },
      signals
    )

    // Base FATAL: 100000/500000/2000000
    // +25% pedestrian, +40% commercial = 1.65x
    expect(settlement.range.low).toBe(165000)
    expect(settlement.range.mid).toBe(825000)
    expect(settlement.range.high).toBe(3300000)
    expect(settlement.factors).toHaveLength(2)

    // MD = contributory negligence
    expect(settlement.stateFactors.faultType).toContain('Contributory negligence')
    expect(settlement.stateFactors.statuteOfLimitations).toBe('3 years')
  })
})
