#!/usr/bin/env tsx
/**
 * Attorney Ingestion Script — Nationwide PI Lawyer Discovery
 *
 * Uses DataForSEO to search Google Maps for personal injury lawyers,
 * fetch full business profiles + all reviews, and publish to database.
 *
 * Usage:
 *   pnpm tsx apps/pipeline/src/scripts/ingest-attorneys.ts [options]
 *
 * Options:
 *   --state XX        Only process one state (e.g., --state CA)
 *   --city "Name"     Only process one city (requires --state)
 *   --dry-run         Print what would be done without API calls
 *   --max-reviews N   Max reviews per attorney (default: 100)
 *   --delay-ms N      Delay between API calls in ms (default: 500)
 *   --max-listings N  Max listings per search query (default: 100)
 *   --resume          Skip states/cities that already have attorneys in DB
 *
 * Required env vars:
 *   DATAFORSEO_LOGIN     DataForSEO API login
 *   DATAFORSEO_PASSWORD  DataForSEO API password
 *   DATABASE_URL         PostgreSQL connection string
 */

import { STATE_CATALOG } from '@velora/shared'
import { prisma } from '@velora/db'
import {
  discoverAttorneysWithReviews,
  discoverAttorneysByRegion,
  TOP_CITIES_BY_STATE,
  STATE_PRIORITY_ORDER,
  STATE_COORDINATE_PINS,
  SEARCH_QUERIES,
  type DataForSEOConfig,
} from '../bronze/sources/dataforseo-adapter'
import { publishAttorneys } from '../gold/attorney-publisher'

interface CliArgs {
  state?: string
  city?: string
  dryRun: boolean
  maxReviews: number
  delayMs: number
  maxListings: number
  resume: boolean
  skipStates: string[]
  budgetLimit: number
  concurrency: number
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    dryRun: false,
    maxReviews: 100,
    delayMs: 500,
    maxListings: 100,
    resume: false,
    skipStates: [],
    budgetLimit: 100,
    concurrency: 5,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        result.state = args[++i]?.toUpperCase()
        break
      case '--city':
        result.city = args[++i]
        break
      case '--dry-run':
        result.dryRun = true
        break
      case '--max-reviews':
        result.maxReviews = parseInt(args[++i]!, 10) || 100
        break
      case '--delay-ms':
        result.delayMs = parseInt(args[++i]!, 10) || 500
        break
      case '--max-listings':
        result.maxListings = parseInt(args[++i]!, 10) || 100
        break
      case '--resume':
        result.resume = true
        break
      case '--skip-states':
        result.skipStates = (args[++i] ?? '').split(',').map(s => s.trim().toUpperCase())
        break
      case '--budget':
        result.budgetLimit = parseFloat(args[++i]!) || 100
        break
      case '--concurrency':
        result.concurrency = parseInt(args[++i]!, 10) || 3
        break
    }
  }

  return result
}

function getOrderedStates(filterState?: string) {
  if (filterState) {
    return STATE_CATALOG.filter((s) => s.code === filterState)
  }

  // Order by STATE_PRIORITY_ORDER
  const stateMap = new Map(STATE_CATALOG.map((s) => [s.code, s]))
  const ordered = []

  for (const code of STATE_PRIORITY_ORDER) {
    const state = stateMap.get(code)
    if (state) {
      ordered.push(state)
      stateMap.delete(code)
    }
  }

  // Any remaining states not in priority list
  for (const state of stateMap.values()) {
    ordered.push(state)
  }

  return ordered
}

/** Load all existing googlePlaceIds from DB to skip re-fetching */
async function loadExistingPlaceIds(): Promise<Set<string>> {
  const existing = await prisma.attorney.findMany({
    select: { googlePlaceId: true },
    where: { googlePlaceId: { not: null } },
  })
  const ids = new Set<string>()
  for (const a of existing) {
    if (a.googlePlaceId) ids.add(a.googlePlaceId)
  }
  console.log(`[Resume] Loaded ${ids.size} existing attorney placeIds from DB`)
  return ids
}

/** Check DataForSEO account balance */
async function checkBalance(config: DataForSEOConfig): Promise<number | null> {
  try {
    const auth = 'Basic ' + Buffer.from(`${config.login}:${config.password}`).toString('base64')
    const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
      headers: { Authorization: auth },
    })
    const data = await res.json() as { tasks?: Array<{ result?: Array<{ money?: { balance?: number } }> }> }
    return data.tasks?.[0]?.result?.[0]?.money?.balance ?? null
  } catch {
    return null
  }
}

async function main() {
  const args = parseArgs()

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    console.error('Missing DATAFORSEO_LOGIN and/or DATAFORSEO_PASSWORD env vars')
    process.exit(1)
  }

  const config: DataForSEOConfig = {
    login,
    password,
    rateLimitMs: args.delayMs,
  }

  let statesToProcess = getOrderedStates(args.state)

  // Skip states that already have good coverage
  if (args.skipStates.length > 0) {
    const skipSet = new Set(args.skipStates)
    statesToProcess = statesToProcess.filter(s => !skipSet.has(s.code))
    console.log(`[Skip] Skipping ${args.skipStates.length} states: ${args.skipStates.join(', ')}`)
  }

  if (statesToProcess.length === 0) {
    console.error(`No states to process (all skipped or unknown state code)`)
    process.exit(1)
  }

  // Load existing placeIds to skip already-ingested attorneys
  const existingPlaceIds = await loadExistingPlaceIds()

  let totalCreated = 0
  let totalUpdated = 0
  let totalReviews = 0
  let totalErrors = 0
  let statesCompleted = 0
  let citiesProcessed = 0

  const totalCities = args.city
    ? 1
    : statesToProcess.reduce((sum, s) => sum + (TOP_CITIES_BY_STATE[s.code]?.length ?? 1), 0)

  // Check initial balance
  const startBalance = await checkBalance(config)

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Velora Attorney Ingestion Pipeline v2               ║
║                                                              ║
║  States: ${statesToProcess.length.toString().padEnd(5)}  | Cities: ${totalCities.toString().padEnd(5)}                   ║
║  Queries: ${SEARCH_QUERIES.length.toString().padEnd(4)} | Max listings/query: ${args.maxListings.toString().padEnd(5)}   ║
║  Max reviews: ${args.maxReviews.toString().padEnd(5)} | Delay: ${args.delayMs}ms                  ║
║  Existing attorneys: ${existingPlaceIds.size.toString().padEnd(6)}                             ║
║  Balance: $${startBalance?.toFixed(2) ?? 'unknown'}                                    ║
╚══════════════════════════════════════════════════════════════╝
`)

  console.log(`Search queries (${SEARCH_QUERIES.length}):`)
  for (const q of SEARCH_QUERIES) console.log(`  - ${q}`)
  console.log(`\nState order: ${statesToProcess.map((s) => s.code).join(', ')}\n`)

  for (const state of statesToProcess) {
    statesCompleted++
    const hasCoordPins = !!STATE_COORDINATE_PINS[state.code]
    const useRegionMode = hasCoordPins && !args.city

    console.log(`\n${'═'.repeat(70)}`)
    console.log(`  ${state.name} (${state.code}) [${statesCompleted}/${statesToProcess.length}] ${useRegionMode ? '🌐 REGION MODE' : '🏙️ CITY MODE'}`)
    console.log(`${'═'.repeat(70)}`)

    if (useRegionMode) {
      // ─── Region-based: coordinate pins with wide zoom ───
      // ~8x cheaper for SERP discovery, reviews at depth=20 (60% savings)
      if (args.dryRun) {
        const pins = STATE_COORDINATE_PINS[state.code]!
        console.log(`    [DRY RUN] Would use ${pins.length} coord pins × 9 queries`)
        continue
      }

      try {
        const results = await discoverAttorneysByRegion(config, state.code, state.name, {
          maxReviewsPerListing: args.maxReviews,
          skipPlaceIds: existingPlaceIds,
        })

        if (results.length === 0) {
          console.log(`    No new attorneys found for ${state.code}`)
        } else {
          const totalReviewsFound = results.reduce((sum, r) => sum + r.reviews.length, 0)
          console.log(`    Found ${results.length} new attorneys, ${totalReviewsFound} reviews`)

          const publishResult = await publishAttorneys(results, {
            city: 'region',
            stateCode: state.code,
          })

          for (const r of results) existingPlaceIds.add(r.profile.placeId)

          totalCreated += publishResult.created
          totalUpdated += publishResult.updated
          totalReviews += publishResult.reviewsAdded
          totalErrors += publishResult.errors.length

          console.log(`    ✓ Created: ${publishResult.created} | Updated: ${publishResult.updated} | Reviews: ${publishResult.reviewsAdded}`)

          if (publishResult.errors.length > 0) {
            console.log(`    ⚠ ${publishResult.errors.length} errors:`)
            for (const err of publishResult.errors.slice(0, 3)) {
              console.log(`      - ${err.placeId}: ${err.error}`)
            }
          }
        }
      } catch (error) {
        console.error(`    ✗ ${state.code} region failed: ${error instanceof Error ? error.message : error}`)
        totalErrors++
      }
    } else {
      // ─── City-based fallback (original approach) ───
      const cities = args.city
        ? [args.city]
        : TOP_CITIES_BY_STATE[state.code] ?? [state.name]

      for (let ci = 0; ci < cities.length; ci += args.concurrency) {
        const batch = cities.slice(ci, ci + args.concurrency)

        const batchPromises = batch.map(async (city) => {
          const cityNum = ci + batch.indexOf(city) + 1 + citiesProcessed
          console.log(`\n  📍 ${city}, ${state.code} [city ${cityNum}/${totalCities}]`)

          if (args.dryRun) {
            console.log(`    [DRY RUN] Would run ${SEARCH_QUERIES.length} queries × depth ${args.maxListings}`)
            return
          }

          try {
            const results = await discoverAttorneysWithReviews(config, {
              city,
              stateCode: state.code,
              stateName: state.name,
            }, {
              maxListings: args.maxListings,
              maxReviewsPerListing: args.maxReviews,
              skipPlaceIds: existingPlaceIds,
            })

            if (results.length === 0) {
              console.log(`    [${city}] No new attorneys found`)
              return
            }

            const totalReviewsFound = results.reduce((sum, r) => sum + r.reviews.length, 0)
            console.log(`    [${city}] Found ${results.length} new attorneys, ${totalReviewsFound} reviews`)

            const publishResult = await publishAttorneys(results, {
              city,
              stateCode: state.code,
            })

            for (const r of results) existingPlaceIds.add(r.profile.placeId)

            totalCreated += publishResult.created
            totalUpdated += publishResult.updated
            totalReviews += publishResult.reviewsAdded
            totalErrors += publishResult.errors.length

            console.log(`    [${city}] ✓ Created: ${publishResult.created} | Updated: ${publishResult.updated} | Reviews: ${publishResult.reviewsAdded}`)

            if (publishResult.errors.length > 0) {
              console.log(`    [${city}] ⚠ ${publishResult.errors.length} errors:`)
              for (const err of publishResult.errors.slice(0, 3)) {
                console.log(`      - ${err.placeId}: ${err.error}`)
              }
            }
          } catch (error) {
            console.error(`    [${city}] ✗ Failed: ${error instanceof Error ? error.message : error}`)
            totalErrors++
          }
        })

        await Promise.all(batchPromises)
        citiesProcessed += batch.length
      }
    }

    // Check balance + log running totals after each state
    const currentBalance = await checkBalance(config)
    const spent = startBalance && currentBalance ? (startBalance - currentBalance).toFixed(2) : '?'
    const spentNum = startBalance && currentBalance ? startBalance - currentBalance : 0
    console.log(`\n  [Running Total] Attorneys: ${totalCreated + totalUpdated} (${totalCreated} new) | Reviews: ${totalReviews} | Errors: ${totalErrors}`)
    console.log(`  [Cost] Balance: $${currentBalance?.toFixed(2) ?? '?'} | Spent this run: $${spent} | Budget: $${args.budgetLimit}`)

    // Budget enforcement
    if (spentNum >= args.budgetLimit) {
      console.log(`\n  ⛔ BUDGET LIMIT REACHED ($${spentNum.toFixed(2)} >= $${args.budgetLimit}). Stopping.`)
      break
    }
  }

  const finalBalance = await checkBalance(config)

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Ingestion Complete                                          ║
║                                                              ║
║  States processed:   ${statesCompleted.toString().padEnd(10)}                             ║
║  Cities processed:   ${citiesProcessed.toString().padEnd(10)}                             ║
║  Attorneys created:  ${totalCreated.toString().padEnd(10)}                             ║
║  Attorneys updated:  ${totalUpdated.toString().padEnd(10)}                             ║
║  Reviews added:      ${totalReviews.toString().padEnd(10)}                             ║
║  Errors:             ${totalErrors.toString().padEnd(10)}                             ║
║  Final balance:      $${(finalBalance?.toFixed(2) ?? '?').padEnd(10)}                            ║
║  Total spent:        $${(startBalance && finalBalance ? (startBalance - finalBalance).toFixed(2) : '?').padEnd(10)}                            ║
╚══════════════════════════════════════════════════════════════╝
`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
