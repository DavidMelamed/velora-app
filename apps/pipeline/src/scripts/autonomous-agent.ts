/**
 * Autonomous Self-Improving Agent
 *
 * A heartbeat loop that continuously asks:
 *   1. How can we get more data?
 *   2. What's broken and how do we fix it?
 *   3. How can we expand coverage?
 *   4. What quality issues exist?
 *
 * Runs alongside continuous-ingest.ts as the "intelligence" layer.
 *
 * Usage:
 *   npx tsx src/scripts/autonomous-agent.ts [--interval-min 30] [--dry-run]
 */

import 'dotenv/config'
import { prisma } from '@velora/db'

const INTERVAL_MIN = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--interval-min') ?? '30')
const DRY_RUN = process.argv.includes('--dry-run')

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ──────────────────────────────────────────────
// 1. DATA QUALITY MONITOR
// ──────────────────────────────────────────────

interface QualityReport {
  totalCrashes: number
  totalDeadLetters: number
  unresolvedDeadLetters: number
  deadLetterPatterns: Array<{ pattern: string; count: number }>
  staleDataSources: Array<{ name: string; lastFetched: Date | null; errorCount: number }>
  failedPipelineRuns24h: number
  coverageByState: Array<{ stateCode: string; count: number }>
}

async function runQualityCheck(): Promise<QualityReport> {
  console.log(`\n[${ts()}] Running data quality check...`)

  const [
    totalCrashes,
    totalDeadLetters,
    unresolvedDeadLetters,
    failedRuns,
    crashesByState,
    dataSources,
  ] = await Promise.all([
    prisma.crash.count(),
    prisma.pipelineDeadLetter.count(),
    prisma.pipelineDeadLetter.count({ where: { resolvedAt: null } }),
    prisma.pipelineRun.count({
      where: { status: 'FAILED', startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.crash.groupBy({ by: ['stateCode'], _count: true, orderBy: { _count: { stateCode: 'desc' } } }),
    prisma.dataSource.findMany({
      select: { name: true, lastFetchedAt: true, errorCount: true, config: true },
    }),
  ])

  // Analyze dead letter patterns — get top 10 error patterns
  const dlPatterns = await prisma.$queryRaw`
    SELECT LEFT(error, 80) as pattern, COUNT(*)::int as cnt
    FROM "PipelineDeadLetter"
    WHERE "resolvedAt" IS NULL
    GROUP BY LEFT(error, 80)
    ORDER BY cnt DESC
    LIMIT 10
  ` as Array<{ pattern: string; cnt: number }>

  // Identify stale data sources (no fetch in 24h and not exhausted)
  const staleSources = dataSources.filter((ds: { config: unknown; lastFetchedAt: Date | null; errorCount: number; name: string }) => {
    const cfg = ds.config as Record<string, unknown> | null
    const isExhausted = cfg?.cursor_exhausted === true
    const lastFetch = ds.lastFetchedAt
    const hoursAgo = lastFetch ? (Date.now() - lastFetch.getTime()) / (1000 * 60 * 60) : Infinity
    return !isExhausted && hoursAgo > 24
  })

  const report: QualityReport = {
    totalCrashes,
    totalDeadLetters,
    unresolvedDeadLetters,
    deadLetterPatterns: dlPatterns.map(p => ({ pattern: p.pattern, count: p.cnt })),
    staleDataSources: staleSources.map(s => ({
      name: s.name,
      lastFetched: s.lastFetchedAt,
      errorCount: s.errorCount,
    })),
    failedPipelineRuns24h: failedRuns,
    coverageByState: crashesByState.map(s => ({ stateCode: s.stateCode, count: s._count })),
  }

  return report
}

// ──────────────────────────────────────────────
// 2. DEAD LETTER HEALER
// ──────────────────────────────────────────────

interface HealingAction {
  action: string
  description: string
  affectedCount: number
  applied: boolean
}

async function runDeadLetterHealing(): Promise<HealingAction[]> {
  console.log(`\n[${ts()}] Running dead letter healing...`)
  const actions: HealingAction[] = []

  // Pattern 1: "parser returned null" — usually means fields changed
  // Mark these as analyzed so we don't keep counting them
  const nullParserCount = await prisma.pipelineDeadLetter.count({
    where: {
      resolvedAt: null,
      error: { contains: 'parser returned null' },
    },
  })

  if (nullParserCount > 0 && !DRY_RUN) {
    // Mark old "parser returned null" dead letters as resolved
    // since we've fixed the parsers
    const resolved = await prisma.pipelineDeadLetter.updateMany({
      where: {
        resolvedAt: null,
        error: { contains: 'parser returned null' },
      },
      data: {
        resolvedAt: new Date(),
      },
    })

    actions.push({
      action: 'RESOLVE_NULL_PARSER',
      description: `Resolved ${resolved.count} dead letters from old parser field mismatches`,
      affectedCount: resolved.count,
      applied: true,
    })
  } else if (nullParserCount > 0) {
    actions.push({
      action: 'RESOLVE_NULL_PARSER',
      description: `Would resolve ${nullParserCount} dead letters from null parser results`,
      affectedCount: nullParserCount,
      applied: false,
    })
  }

  // Pattern 2: Validation errors — analyze what fields fail
  const validationErrors = await prisma.pipelineDeadLetter.findMany({
    where: {
      resolvedAt: null,
      errorType: 'VALIDATION',
    },
    select: { error: true },
    take: 50,
  })

  if (validationErrors.length > 0) {
    // Count which fields fail most often
    const fieldFailures: Record<string, number> = {}
    for (const ve of validationErrors) {
      const matches = ve.error.matchAll(/(\w+): (.+?)(?:;|$)/g)
      for (const match of matches) {
        const field = match[1]
        fieldFailures[field] = (fieldFailures[field] || 0) + 1
      }
    }

    const topFailures = Object.entries(fieldFailures)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    if (topFailures.length > 0) {
      actions.push({
        action: 'REPORT_VALIDATION_HOTSPOTS',
        description: `Top validation failures: ${topFailures.map(([f, c]) => `${f}(${c})`).join(', ')}`,
        affectedCount: validationErrors.length,
        applied: false,
      })
    }
  }

  // Pattern 3: Reset stuck pipeline runs (RUNNING for >1 hour)
  const stuckRuns = await prisma.pipelineRun.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  })

  if (stuckRuns.length > 0 && !DRY_RUN) {
    for (const run of stuckRuns) {
      await prisma.pipelineRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs: Date.now() - run.startedAt.getTime(),
          errorLog: { error: 'auto-resolved: pipeline run stuck for >1 hour' },
        },
      })
    }

    actions.push({
      action: 'RESET_STUCK_RUNS',
      description: `Reset ${stuckRuns.length} stuck pipeline runs (RUNNING >1h)`,
      affectedCount: stuckRuns.length,
      applied: true,
    })
  }

  return actions
}

// ──────────────────────────────────────────────
// 3. SOURCE DISCOVERY
// ──────────────────────────────────────────────

interface DiscoveryResult {
  datasetsFound: Array<{ name: string; domain: string; datasetId: string; description: string }>
  alreadyKnown: number
  newDiscoveries: number
}

const KNOWN_SOCRATA_DOMAINS = [
  { domain: 'data.cityofnewyork.us', name: 'NYC' },
  { domain: 'data.cityofchicago.org', name: 'Chicago' },
  { domain: 'data.colorado.gov', name: 'Colorado' },
  { domain: 'data.lacity.org', name: 'Los Angeles' },
  { domain: 'data.sfgov.org', name: 'San Francisco' },
  { domain: 'data.wa.gov', name: 'Washington' },
  // New domains to explore
  { domain: 'data.austintexas.gov', name: 'Austin' },
  { domain: 'data.detroitmi.gov', name: 'Detroit' },
  { domain: 'data.seattle.gov', name: 'Seattle' },
  { domain: 'data.boston.gov', name: 'Boston' },
  { domain: 'data.nashville.gov', name: 'Nashville' },
  { domain: 'data.cityofmadison.com', name: 'Madison' },
  { domain: 'data.maryland.gov', name: 'Maryland' },
  { domain: 'data.ct.gov', name: 'Connecticut' },
  { domain: 'data.iowa.gov', name: 'Iowa' },
  { domain: 'data.texas.gov', name: 'Texas' },
  { domain: 'data.ny.gov', name: 'New York State' },
  { domain: 'data.virginia.gov', name: 'Virginia' },
  { domain: 'data.michigan.gov', name: 'Michigan' },
  { domain: 'data.oregon.gov', name: 'Oregon' },
]

const KNOWN_DATASET_IDS = new Set([
  'h9gi-nx95', // NYC
  '85ca-t3if', // Chicago
  'cpwf-cznk', // Denver
  'bjpt-tkzq', // CO Springs
  'd5tf-ez2w', // LA
  'ubvf-ztfx', // SF
  'qau6-fd9y', // Washington
])

async function discoverNewSources(): Promise<DiscoveryResult> {
  console.log(`\n[${ts()}] Discovering new Socrata crash datasets...`)

  const discoveries: DiscoveryResult['datasetsFound'] = []
  let alreadyKnown = 0

  // Search each domain for crash-related datasets
  const searchTerms = ['crash', 'collision', 'traffic accident', 'motor vehicle']

  for (const { domain, name } of KNOWN_SOCRATA_DOMAINS) {
    for (const term of searchTerms) {
      try {
        const url = `https://${domain}/api/catalog/v1?q=${encodeURIComponent(term)}&limit=5&only=datasets`
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Velora-Discovery/1.0' },
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) continue

        const data = await response.json() as { results?: Array<{ resource: { id: string; name: string; description?: string; columns_field_name?: string[] } }> }

        if (!data.results) continue

        for (const result of data.results) {
          const id = result.resource.id
          if (KNOWN_DATASET_IDS.has(id)) {
            alreadyKnown++
            continue
          }

          // Check if it looks like a crash dataset (has date + location fields)
          const cols = result.resource.columns_field_name ?? []
          const hasDate = cols.some(c => /date|time|occ/i.test(c))
          const hasLocation = cols.some(c => /lat|lon|location|point|geo/i.test(c))

          if (hasDate && hasLocation) {
            KNOWN_DATASET_IDS.add(id) // prevent duplicates within this run
            discoveries.push({
              name: `${name}: ${result.resource.name}`,
              domain,
              datasetId: id,
              description: (result.resource.description ?? '').substring(0, 200),
            })
          }
        }
      } catch {
        // Domain unreachable or rate limited — skip
      }

      // Rate limit between searches
      await sleep(500)
    }
  }

  return {
    datasetsFound: discoveries,
    alreadyKnown,
    newDiscoveries: discoveries.length,
  }
}

// ──────────────────────────────────────────────
// 4. COVERAGE ANALYZER
// ──────────────────────────────────────────────

interface CoverageReport {
  statesWithData: number
  statesWithoutData: string[]
  topStates: Array<{ state: string; count: number }>
  recommendations: string[]
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

async function analyzeCoverage(): Promise<CoverageReport> {
  console.log(`\n[${ts()}] Analyzing data coverage...`)

  const crashesByState = await prisma.crash.groupBy({
    by: ['stateCode'],
    _count: true,
    orderBy: { _count: { stateCode: 'desc' } },
  })

  const statesWithData = new Set(crashesByState.map((s: { stateCode: string }) => s.stateCode))
  const statesWithoutData = US_STATES.filter((s: string) => !statesWithData.has(s))

  const recommendations: string[] = []

  // Prioritize states by population that we don't have data for
  const highPriorityMissing = ['TX', 'FL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'AZ']
    .filter(s => !statesWithData.has(s))

  if (highPriorityMissing.length > 0) {
    recommendations.push(
      `High-priority states without data: ${highPriorityMissing.join(', ')}. Search Socrata/ArcGIS for datasets.`
    )
  }

  // Check for states with very low counts
  const lowCountStates = crashesByState.filter(s => s._count < 100)
  if (lowCountStates.length > 0) {
    recommendations.push(
      `Low data states (<100 crashes): ${lowCountStates.map(s => `${s.stateCode}(${s._count})`).join(', ')}`
    )
  }

  // Dead letter ratio
  const totalDL = await prisma.pipelineDeadLetter.count({ where: { resolvedAt: null } })
  const totalCrashes = crashesByState.reduce((sum, s) => sum + s._count, 0)
  const dlRatio = totalCrashes > 0 ? totalDL / totalCrashes : 0

  if (dlRatio > 0.5) {
    recommendations.push(
      `High dead letter ratio: ${(dlRatio * 100).toFixed(0)}% — parser fixes needed`
    )
  }

  return {
    statesWithData: statesWithData.size,
    statesWithoutData,
    topStates: crashesByState.slice(0, 10).map(s => ({ state: s.stateCode, count: s._count })),
    recommendations,
  }
}

// ──────────────────────────────────────────────
// MAIN HEARTBEAT LOOP
// ──────────────────────────────────────────────

let cycleCount = 0

async function runHeartbeat() {
  cycleCount++
  const startTime = Date.now()

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`[${ts()}] AUTONOMOUS AGENT — Cycle #${cycleCount}`)
  console.log(`${'═'.repeat(70)}`)

  // Run all checks
  const quality = await runQualityCheck()
  const healingActions = await runDeadLetterHealing()
  const coverage = await analyzeCoverage()

  // Run discovery every 5th cycle (it hits external APIs)
  let discovery: DiscoveryResult | null = null
  if (cycleCount % 5 === 1) {
    discovery = await discoverNewSources()
  }

  // ──────── REPORT ────────
  const durationMs = Date.now() - startTime

  console.log(`\n${'─'.repeat(70)}`)
  console.log(`[${ts()}] HEARTBEAT REPORT — Cycle #${cycleCount} (${durationMs}ms)`)
  console.log(`${'─'.repeat(70)}`)

  console.log(`\n  📊 DATA QUALITY`)
  console.log(`    Total crashes: ${quality.totalCrashes.toLocaleString()}`)
  console.log(`    Dead letters: ${quality.unresolvedDeadLetters.toLocaleString()} unresolved / ${quality.totalDeadLetters.toLocaleString()} total`)
  console.log(`    Failed runs (24h): ${quality.failedPipelineRuns24h}`)

  if (quality.deadLetterPatterns.length > 0) {
    console.log(`    Top dead letter patterns:`)
    quality.deadLetterPatterns.slice(0, 5).forEach(p => {
      console.log(`      ${p.count}x: ${p.pattern}`)
    })
  }

  if (quality.staleDataSources.length > 0) {
    console.log(`    Stale data sources:`)
    quality.staleDataSources.forEach(s => {
      console.log(`      ${s.name} (errors: ${s.errorCount})`)
    })
  }

  if (healingActions.length > 0) {
    console.log(`\n  🔧 HEALING ACTIONS`)
    healingActions.forEach(a => {
      console.log(`    ${a.applied ? '✓' : '○'} ${a.action}: ${a.description}`)
    })
  }

  console.log(`\n  🗺️  COVERAGE`)
  console.log(`    States with data: ${coverage.statesWithData}/51`)
  console.log(`    Top states: ${coverage.topStates.slice(0, 5).map(s => `${s.state}(${s.count.toLocaleString()})`).join(', ')}`)
  if (coverage.statesWithoutData.length > 0 && coverage.statesWithoutData.length <= 10) {
    console.log(`    Missing: ${coverage.statesWithoutData.join(', ')}`)
  }

  if (coverage.recommendations.length > 0) {
    console.log(`\n  💡 RECOMMENDATIONS`)
    coverage.recommendations.forEach(r => console.log(`    • ${r}`))
  }

  if (discovery) {
    console.log(`\n  🔍 SOURCE DISCOVERY`)
    console.log(`    Already known: ${discovery.alreadyKnown}`)
    console.log(`    New discoveries: ${discovery.newDiscoveries}`)
    if (discovery.datasetsFound.length > 0) {
      console.log(`    New datasets found:`)
      discovery.datasetsFound.forEach(d => {
        console.log(`      📦 ${d.name} (${d.domain}/${d.datasetId})`)
        if (d.description) console.log(`         ${d.description.substring(0, 100)}`)
      })
    }
  }

  // Log to AgentSession table
  try {
    await prisma.agentSession.create({
      data: {
        agentId: 'autonomous-heartbeat',
        action: 'heartbeat_cycle',
        input: {
          cycle: cycleCount,
          dryRun: DRY_RUN,
        },
        output: {
          quality: {
            crashes: quality.totalCrashes,
            deadLetters: quality.unresolvedDeadLetters,
            failedRuns: quality.failedPipelineRuns24h,
          },
          healing: healingActions.map(a => ({ action: a.action, count: a.affectedCount, applied: a.applied })),
          coverage: {
            statesWithData: coverage.statesWithData,
            recommendations: coverage.recommendations,
          },
          discoveries: discovery?.newDiscoveries ?? 0,
        },
        status: 'SUCCESS',
        durationMs,
      },
    })
  } catch {
    // AgentSession logging is best-effort
  }

  console.log(`\n${'─'.repeat(70)}`)

  return { quality, healingActions, coverage, discovery }
}

// ──────────────────────────────────────────────
// ENTRY POINT
// ──────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              Velora Autonomous Self-Improving Agent                  ║
║                                                                      ║
║  Interval: ${String(INTERVAL_MIN).padEnd(4)} minutes  |  Dry Run: ${String(DRY_RUN).padEnd(5)}                  ║
║                                                                      ║
║  Capabilities:                                                       ║
║    • Data quality monitoring                                         ║
║    • Dead letter pattern analysis & auto-healing                     ║
║    • Coverage gap detection                                          ║
║    • New data source discovery (Socrata catalog)                     ║
║    • Stuck pipeline run recovery                                     ║
╚══════════════════════════════════════════════════════════════════════╝
`)

  while (true) {
    try {
      await runHeartbeat()
    } catch (error) {
      console.error(`\n[${ts()}] Heartbeat cycle failed:`, error)
    }

    console.log(`\n[${ts()}] Next cycle in ${INTERVAL_MIN} minutes...`)
    await sleep(INTERVAL_MIN * 60 * 1000)
  }
}

process.on('SIGINT', async () => {
  console.log(`\n\n[${ts()}] Autonomous agent shutting down...`)
  console.log(`  Cycles completed: ${cycleCount}`)
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

main().catch(async (error) => {
  console.error('Fatal:', error)
  await prisma.$disconnect()
  process.exit(1)
})
