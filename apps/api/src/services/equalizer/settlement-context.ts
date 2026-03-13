import { STATE_BY_CODE } from '@velora/shared'
import type { LiabilitySignal } from './liability-signals'
import type { ComparableCohort } from './comparable-engine'

export interface SettlementContext {
  range: { low: number; mid: number; high: number }
  factors: string[]
  stateFactors: {
    faultType: string
    statuteOfLimitations: string
    damageCaps: string | null
  }
  disclaimer: string
}

// Base ranges by severity
const BASE_RANGES: Record<string, { low: number; mid: number; high: number }> = {
  PROPERTY_DAMAGE_ONLY: { low: 0, mid: 2500, high: 5000 },
  POSSIBLE_INJURY: { low: 2000, mid: 10000, high: 25000 },
  SUSPECTED_MINOR_INJURY: { low: 5000, mid: 15000, high: 50000 },
  SUSPECTED_SERIOUS_INJURY: { low: 25000, mid: 75000, high: 250000 },
  FATAL: { low: 100000, mid: 500000, high: 2000000 },
}

// Adjustment rules
interface AdjustmentRule {
  name: string
  test: (ctx: AdjustmentContext) => boolean
  multiplier: number // positive = increase, negative = decrease
}

interface AdjustmentContext {
  crash: CrashForSettlement
  signals: LiabilitySignal[]
  cohort: ComparableCohort
}

export interface CrashForSettlement {
  crashSeverity: string | null
  stateCode: string
  vehicles: {
    bodyType: string | null
  }[]
  persons: {
    personType: string
  }[]
}

const ADJUSTMENT_RULES: AdjustmentRule[] = [
  {
    name: 'Multi-vehicle (>2)',
    test: (ctx) => ctx.crash.vehicles.length > 2,
    multiplier: 0.15,
  },
  {
    name: 'Pedestrian involved',
    test: (ctx) => ctx.crash.persons.some((p) => p.personType === 'PEDESTRIAN'),
    multiplier: 0.25,
  },
  {
    name: 'Impaired driver',
    test: (ctx) => ctx.signals.some((s) => s.signal === 'IMPAIRED_DRIVER'),
    multiplier: 0.3,
  },
  {
    name: 'Commercial vehicle',
    test: (ctx) =>
      ctx.crash.vehicles.some(
        (v) => v.bodyType === 'MEDIUM_HEAVY_TRUCK' || v.bodyType === 'TRUCK_TRACTOR'
      ),
    multiplier: 0.4,
  },
  {
    name: 'Adverse weather',
    test: (ctx) => ctx.signals.some((s) => s.signal === 'ADVERSE_WEATHER'),
    multiplier: -0.1,
  },
]

const DISCLAIMER = 'This analysis is based on public crash data and is not legal advice.'

const FAULT_TYPE_LABELS: Record<string, string> = {
  PURE_COMPARATIVE: 'Pure comparative fault — damages reduced by percentage of fault',
  MODIFIED_50: 'Modified comparative (50%) — barred from recovery if 50%+ at fault',
  MODIFIED_51: 'Modified comparative (51%) — barred from recovery if 51%+ at fault',
  CONTRIBUTORY: 'Contributory negligence — any fault may bar recovery entirely',
}

/**
 * Generate settlement context with base ranges, adjustment multipliers, and state factors.
 */
export function generateSettlementContext(
  crash: CrashForSettlement,
  cohort: ComparableCohort,
  signals: LiabilitySignal[]
): SettlementContext {
  const severity = crash.crashSeverity || 'PROPERTY_DAMAGE_ONLY'
  const base = BASE_RANGES[severity] || BASE_RANGES.PROPERTY_DAMAGE_ONLY

  const ctx: AdjustmentContext = { crash, signals, cohort }
  const factors: string[] = []
  let totalMultiplier = 1.0

  for (const rule of ADJUSTMENT_RULES) {
    if (rule.test(ctx)) {
      totalMultiplier += rule.multiplier
      const pct = rule.multiplier > 0 ? `+${Math.round(rule.multiplier * 100)}%` : `${Math.round(rule.multiplier * 100)}%`
      factors.push(`${rule.name}: ${pct}`)
    }
  }

  // Apply multiplier to base range
  const range = {
    low: Math.round(base.low * totalMultiplier),
    mid: Math.round(base.mid * totalMultiplier),
    high: Math.round(base.high * totalMultiplier),
  }

  // State factors
  const stateConfig = STATE_BY_CODE[crash.stateCode]
  const stateFactors = {
    faultType: stateConfig
      ? FAULT_TYPE_LABELS[stateConfig.faultType] || stateConfig.faultType
      : 'Unknown fault system',
    statuteOfLimitations: stateConfig
      ? `${stateConfig.statuteOfLimitationsYears} year${stateConfig.statuteOfLimitationsYears !== 1 ? 's' : ''}`
      : 'Unknown',
    damageCaps: null as string | null, // No state-specific damage caps in catalog yet
  }

  return {
    range,
    factors,
    stateFactors,
    disclaimer: DISCLAIMER,
  }
}
