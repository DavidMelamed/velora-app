export interface LiabilitySignal {
  signal: string
  type: 'FAULT' | 'SHARED' | 'INFRASTRUCTURE' | 'ENVIRONMENTAL'
  confidence: number // 0-1
  sourceField: string
  humanReadable: string
}

export interface CrashForLiability {
  mannerOfCollision: string | null
  crashRelatedFactors: string[]
  atmosphericCondition: string | null
  lightCondition: string | null
  workZone: unknown
  vehicles: {
    bodyType: string | null
    contributingCircumstances: string[]
    driver: {
      suspectedAlcoholDrug: boolean | null
      driverActions: string[]
    } | null
  }[]
  persons: {
    personType: string
  }[]
}

type LiabilityRule = {
  name: string
  extract: (crash: CrashForLiability) => LiabilitySignal | null
}

const RULES: LiabilityRule[] = [
  // Rule 1: Rear-end collision (FRONT_TO_REAR) -> Following driver presumed at fault
  {
    name: 'rear-end',
    extract: (crash) => {
      if (crash.mannerOfCollision === 'FRONT_TO_REAR') {
        return {
          signal: 'REAR_END_COLLISION',
          type: 'FAULT',
          confidence: 0.85,
          sourceField: 'mannerOfCollision',
          humanReadable: 'Rear-end collision: following driver is presumed at fault in most jurisdictions',
        }
      }
      return null
    },
  },

  // Rule 2: Traffic signal violation
  {
    name: 'signal-violation',
    extract: (crash) => {
      const hasViolation = crash.crashRelatedFactors.some(
        (f) => f.includes('SIGNAL_VIOLATION') || f.includes('TRAFFIC_SIGNAL') || f.includes('RAN_RED_LIGHT')
      )
      if (hasViolation) {
        return {
          signal: 'SIGNAL_VIOLATION',
          type: 'FAULT',
          confidence: 0.9,
          sourceField: 'crashRelatedFactors',
          humanReadable: 'Traffic signal violation detected: strong indicator of fault',
        }
      }
      return null
    },
  },

  // Rule 3: Following too close (driver action)
  {
    name: 'following-too-close',
    extract: (crash) => {
      const hasTooClose = crash.vehicles.some(
        (v) =>
          v.driver?.driverActions.some(
            (a) => a.includes('FOLLOWING_TOO_CLOSE') || a.includes('TAILGATING')
          ) ||
          v.contributingCircumstances.some(
            (c) => c.includes('FOLLOWING_TOO_CLOSE') || c.includes('TAILGATING')
          )
      )
      if (hasTooClose) {
        return {
          signal: 'FOLLOWING_TOO_CLOSE',
          type: 'FAULT',
          confidence: 0.8,
          sourceField: 'driverActions',
          humanReadable: 'Driver cited for following too closely',
        }
      }
      return null
    },
  },

  // Rule 4: Impairment (suspectedAlcoholDrug)
  {
    name: 'impairment',
    extract: (crash) => {
      const hasImpairment = crash.vehicles.some((v) => v.driver?.suspectedAlcoholDrug === true)
      if (hasImpairment) {
        return {
          signal: 'IMPAIRED_DRIVER',
          type: 'FAULT',
          confidence: 0.95,
          sourceField: 'suspectedAlcoholDrug',
          humanReadable: 'Suspected alcohol or drug impairment: very strong fault indicator',
        }
      }
      return null
    },
  },

  // Rule 5: Adverse weather (RAIN/SNOW/SLEET)
  {
    name: 'adverse-weather',
    extract: (crash) => {
      const adverseWeather = ['RAIN', 'SNOW', 'SLEET_HAIL_FREEZING_RAIN', 'BLOWING_SNOW']
      if (crash.atmosphericCondition && adverseWeather.includes(crash.atmosphericCondition)) {
        return {
          signal: 'ADVERSE_WEATHER',
          type: 'ENVIRONMENTAL',
          confidence: 0.5,
          sourceField: 'atmosphericCondition',
          humanReadable: 'Adverse weather conditions may have contributed to the crash',
        }
      }
      return null
    },
  },

  // Rule 6: Dark unlighted road
  {
    name: 'dark-unlighted',
    extract: (crash) => {
      if (crash.lightCondition === 'DARK_NOT_LIGHTED') {
        return {
          signal: 'DARK_UNLIGHTED_ROAD',
          type: 'INFRASTRUCTURE',
          confidence: 0.6,
          sourceField: 'lightCondition',
          humanReadable: 'Crash occurred on a dark, unlighted roadway: potential infrastructure issue',
        }
      }
      return null
    },
  },

  // Rule 7: Work zone
  {
    name: 'work-zone',
    extract: (crash) => {
      if (crash.workZone != null && crash.workZone !== false) {
        return {
          signal: 'WORK_ZONE',
          type: 'SHARED',
          confidence: 0.55,
          sourceField: 'workZone',
          humanReadable: 'Crash occurred in a work zone: liability may be shared with construction entity',
        }
      }
      return null
    },
  },
]

/**
 * Extract liability signals from crash data using 7 rule-based extractors.
 * Returns all matching signals sorted by confidence descending.
 */
export function extractLiabilitySignals(crash: CrashForLiability): LiabilitySignal[] {
  const signals: LiabilitySignal[] = []

  for (const rule of RULES) {
    const signal = rule.extract(crash)
    if (signal) {
      signals.push(signal)
    }
  }

  // Sort by confidence descending
  signals.sort((a, b) => b.confidence - a.confidence)

  return signals
}
