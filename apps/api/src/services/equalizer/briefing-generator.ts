import { prisma, type Prisma } from '@velora/db'
import { findComparableCrashes, type ComparableCohort } from './comparable-engine'
import { extractLiabilitySignals, type LiabilitySignal, type CrashForLiability } from './liability-signals'
import { generateSettlementContext, type SettlementContext } from './settlement-context'

export interface EqualizerResult {
  comparableCohort: ComparableCohort
  liabilitySignals: LiabilitySignal[]
  settlementContext: SettlementContext
  attorneyMatches: AttorneyMatchResult[]
  briefingSections: BriefingSections
  disclaimer: string
  generationMs: number
}

export interface AttorneyMatchResult {
  id: string
  name: string
  firmName: string | null
  city: string | null
  indexScore: number | null
  distance: number | null
}

export interface BriefingSections {
  whatHappened: string
  whatThisMeans: string
  crashesLikeYours: string
  yourRights: string
  nextSteps: string
}

// Using shared prisma instance from @velora/db

/**
 * Generate a full Equalizer briefing for a crash.
 * Orchestrates: comparable matching, liability extraction, settlement context,
 * attorney matching, and AI-generated briefing sections.
 */
export async function generateEqualizerBriefing(crashId: string): Promise<EqualizerResult> {
  const startTime = Date.now()

  // 1. Load crash with all relations
  const crash = await prisma.crash.findUnique({
    where: { id: crashId },
    include: {
      vehicles: {
        include: {
          driver: true,
        },
      },
      persons: true,
    },
  })

  if (!crash) {
    throw new Error(`Crash not found: ${crashId}`)
  }

  // 2. Find comparable crashes
  const comparableCohort = await findComparableCrashes(
    {
      id: crash.id,
      mannerOfCollision: crash.mannerOfCollision,
      crashSeverity: crash.crashSeverity,
      atmosphericCondition: crash.atmosphericCondition,
      lightCondition: crash.lightCondition,
      intersectionType: crash.intersectionType,
      stateCode: crash.stateCode,
      crashRelatedFactors: crash.crashRelatedFactors,
      vehicles: crash.vehicles.map((v) => ({ id: v.id })),
      persons: crash.persons.map((p) => ({
        injuryStatus: p.injuryStatus,
        personType: p.personType,
      })),
      crashDate: crash.crashDate,
    },
    { prisma, excludeCrashId: crash.id }
  )

  // 3. Extract liability signals
  const crashForLiability: CrashForLiability = {
    mannerOfCollision: crash.mannerOfCollision,
    crashRelatedFactors: crash.crashRelatedFactors,
    atmosphericCondition: crash.atmosphericCondition,
    lightCondition: crash.lightCondition,
    workZone: crash.workZone,
    vehicles: crash.vehicles.map((v) => ({
      bodyType: v.bodyType,
      contributingCircumstances: v.contributingCircumstances,
      driver: v.driver
        ? {
            suspectedAlcoholDrug: v.driver.suspectedAlcoholDrug,
            driverActions: v.driver.driverActions,
          }
        : null,
    })),
    persons: crash.persons.map((p) => ({
      personType: p.personType,
    })),
  }
  const liabilitySignals = extractLiabilitySignals(crashForLiability)

  // 4. Generate settlement context
  const settlementContext = generateSettlementContext(
    {
      crashSeverity: crash.crashSeverity,
      stateCode: crash.stateCode,
      vehicles: crash.vehicles.map((v) => ({ bodyType: v.bodyType })),
      persons: crash.persons.map((p) => ({ personType: p.personType })),
    },
    comparableCohort,
    liabilitySignals
  )

  // 5. Find top 5 attorney matches by state/city, sorted by index score
  const attorneyMatches = await findTopAttorneys(crash.stateCode, crash.cityName, 5)

  // 6. Generate briefing sections
  //    In production this would use AI (streamText with standard tier model).
  //    For now, generate template-based sections that can be replaced with AI later.
  const briefingSections = generateTemplateBriefing(
    crash,
    comparableCohort,
    liabilitySignals,
    settlementContext
  )

  const generationMs = Date.now() - startTime

  // 7. Upsert CrashEqualizer record
  await prisma.crashEqualizer.upsert({
    where: { crashId },
    create: {
      crashId,
      comparableCohort: JSON.parse(JSON.stringify(comparableCohort)) as Prisma.InputJsonValue,
      confidenceLevel: comparableCohort.confidence,
      liabilitySignals: JSON.parse(JSON.stringify(liabilitySignals)) as Prisma.InputJsonValue,
      settlementContext: JSON.parse(JSON.stringify(settlementContext)) as Prisma.InputJsonValue,
      attorneyMatches: JSON.parse(JSON.stringify(attorneyMatches)) as Prisma.InputJsonValue,
      briefingSections: JSON.parse(JSON.stringify(briefingSections)) as Prisma.InputJsonValue,
      modelVersion: 'template-v1',
      generationMs,
    },
    update: {
      comparableCohort: JSON.parse(JSON.stringify(comparableCohort)) as Prisma.InputJsonValue,
      confidenceLevel: comparableCohort.confidence,
      liabilitySignals: JSON.parse(JSON.stringify(liabilitySignals)) as Prisma.InputJsonValue,
      settlementContext: JSON.parse(JSON.stringify(settlementContext)) as Prisma.InputJsonValue,
      attorneyMatches: JSON.parse(JSON.stringify(attorneyMatches)) as Prisma.InputJsonValue,
      briefingSections: JSON.parse(JSON.stringify(briefingSections)) as Prisma.InputJsonValue,
      modelVersion: 'template-v1',
      generationMs,
      generatedAt: new Date(),
    },
  })

  return {
    comparableCohort,
    liabilitySignals,
    settlementContext,
    attorneyMatches,
    briefingSections,
    disclaimer: settlementContext.disclaimer,
    generationMs,
  }
}

async function findTopAttorneys(
  stateCode: string,
  cityName: string | null,
  limit: number
): Promise<AttorneyMatchResult[]> {
  // First try city match, then fall back to state
  const attorneys = await prisma.attorney.findMany({
    where: {
      stateCode,
      ...(cityName ? { city: cityName } : {}),
    },
    include: {
      attorneyIndex: { select: { score: true } },
    },
    take: limit * 2, // Get extra to sort by score
  })

  // If city search yielded too few, expand to state
  let results = attorneys
  if (results.length < limit && cityName) {
    const stateAttorneys = await prisma.attorney.findMany({
      where: {
        stateCode,
        id: { notIn: results.map((a) => a.id) },
      },
      include: {
        attorneyIndex: { select: { score: true } },
      },
      take: limit - results.length,
    })
    results = [...results, ...stateAttorneys]
  }

  // Sort by index score descending
  return results
    .map((a) => ({
      id: a.id,
      name: a.name,
      firmName: a.firmName,
      city: a.city,
      indexScore: a.attorneyIndex?.score ?? null,
      distance: null, // Would compute from lat/lng in production
    }))
    .sort((a, b) => (b.indexScore ?? 0) - (a.indexScore ?? 0))
    .slice(0, limit)
}

function generateTemplateBriefing(
  crash: {
    crashSeverity: string | null
    mannerOfCollision: string | null
    stateCode: string
    cityName: string | null
    county: string | null
    crashDate: Date
  },
  cohort: ComparableCohort,
  signals: LiabilitySignal[],
  settlement: SettlementContext
): BriefingSections {
  const location = [crash.cityName, crash.county, crash.stateCode].filter(Boolean).join(', ')
  const date = crash.crashDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const severity = (crash.crashSeverity || 'unknown severity').replace(/_/g, ' ').toLowerCase()

  return {
    whatHappened: `On ${date}, a ${severity} crash was reported in ${location || crash.stateCode}. ` +
      `The collision type was ${(crash.mannerOfCollision || 'unknown').replace(/_/g, ' ').toLowerCase()}.`,

    whatThisMeans: signals.length > 0
      ? `Based on the crash data, ${signals.length} liability signal${signals.length > 1 ? 's were' : ' was'} identified. ` +
        `The strongest indicator: ${signals[0].humanReadable}.`
      : 'No strong liability signals were identified from the available crash data.',

    crashesLikeYours: cohort.count > 0
      ? `We analyzed ${cohort.count} similar crashes (${cohort.confidence} confidence). ` +
        `The injury rate in comparable crashes is ${(cohort.injuryRate * 100).toFixed(1)}%.`
      : 'Insufficient comparable crash data is available for this analysis.',

    yourRights: `In ${crash.stateCode}, the statute of limitations is ${settlement.stateFactors.statuteOfLimitations}. ` +
      `${settlement.stateFactors.faultType}.`,

    nextSteps: 'Document everything: photos of damage, medical records, police report number. ' +
      'Do not give recorded statements to insurance adjusters without legal counsel. ' +
      'Consider consulting a personal injury attorney — most offer free initial consultations.',
  }
}

/**
 * Load a cached Equalizer briefing. Returns null if not yet generated.
 */
export async function getCachedBriefing(crashId: string) {
  return prisma.crashEqualizer.findUnique({
    where: { crashId },
  })
}
