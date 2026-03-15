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
 *   --max-listings N  Max listings per search query (default: 20)
 *
 * Required env vars:
 *   DATAFORSEO_LOGIN     DataForSEO API login
 *   DATAFORSEO_PASSWORD  DataForSEO API password
 *   DATABASE_URL         PostgreSQL connection string
 */

import { STATE_CATALOG } from '@velora/shared'
import {
  discoverAttorneysWithReviews,
  TOP_CITIES_BY_STATE,
  STATE_PRIORITY_ORDER,
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
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    dryRun: false,
    maxReviews: 100,
    delayMs: 500,
    maxListings: 20,
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
        result.maxListings = parseInt(args[++i]!, 10) || 20
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

async function main() {
  const args = parseArgs()

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    console.error('Missing DATAFORSEO_LOGIN and/or DATAFORSEO_PASSWORD env vars')
    console.error('Set these in .env (credentials from crashstory-platform)')
    process.exit(1)
  }

  const config: DataForSEOConfig = {
    login,
    password,
    rateLimitMs: args.delayMs,
  }

  const statesToProcess = getOrderedStates(args.state)

  if (statesToProcess.length === 0) {
    console.error(`Unknown state code: ${args.state}`)
    process.exit(1)
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalReviews = 0
  let totalErrors = 0
  let statesCompleted = 0

  const totalCities = args.city
    ? 1
    : statesToProcess.reduce((sum, s) => sum + (TOP_CITIES_BY_STATE[s.code]?.length ?? 1), 0)

  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Velora Attorney Ingestion Pipeline              ║
║                                                          ║
║  States: ${statesToProcess.length.toString().padEnd(5)}  | Cities: ${totalCities.toString().padEnd(5)}               ║
║  Max reviews: ${args.maxReviews.toString().padEnd(5)} | Max listings: ${args.maxListings.toString().padEnd(5)}       ║
║  Delay: ${args.delayMs}ms   | Dry run: ${args.dryRun.toString().padEnd(10)}        ║
╚══════════════════════════════════════════════════════════╝
`)

  console.log(`State order: ${statesToProcess.map((s) => s.code).join(', ')}\n`)

  for (const state of statesToProcess) {
    const cities = args.city
      ? [args.city]
      : TOP_CITIES_BY_STATE[state.code] ?? [state.name]

    statesCompleted++
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  ${state.name} (${state.code}) — ${cities.length} cities [${statesCompleted}/${statesToProcess.length}]`)
    console.log(`${'═'.repeat(60)}`)

    for (const city of cities) {
      console.log(`\n  📍 ${city}, ${state.code}`)

      if (args.dryRun) {
        console.log(`    [DRY RUN] Would search: "personal injury lawyer", "car accident attorney", "auto accident lawyer"`)
        console.log(`    [DRY RUN] Would fetch full business profiles + up to ${args.maxReviews} reviews each`)
        continue
      }

      try {
        const results = await discoverAttorneysWithReviews(config, {
          city,
          stateCode: state.code,
          stateName: state.name,
        }, {
          maxListings: args.maxListings,
          maxReviewsPerListing: args.maxReviews,
        })

        if (results.length === 0) {
          console.log(`    No attorneys found`)
          continue
        }

        const totalReviewsFound = results.reduce((sum, r) => sum + r.reviews.length, 0)
        console.log(`    Found ${results.length} attorneys, ${totalReviewsFound} reviews`)

        const publishResult = await publishAttorneys(results, {
          city,
          stateCode: state.code,
        })

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
      } catch (error) {
        console.error(`    ✗ Failed: ${error instanceof Error ? error.message : error}`)
        totalErrors++
      }

      // Rate limit between cities
      await new Promise((r) => setTimeout(r, args.delayMs))
    }

    // Log running totals after each state
    console.log(`\n  [Running Total] Attorneys: ${totalCreated + totalUpdated} (${totalCreated} new) | Reviews: ${totalReviews} | Errors: ${totalErrors}`)
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Ingestion Complete                                      ║
║                                                          ║
║  States processed:   ${statesCompleted.toString().padEnd(10)}                         ║
║  Attorneys created:  ${totalCreated.toString().padEnd(10)}                         ║
║  Attorneys updated:  ${totalUpdated.toString().padEnd(10)}                         ║
║  Reviews added:      ${totalReviews.toString().padEnd(10)}                         ║
║  Errors:             ${totalErrors.toString().padEnd(10)}                         ║
╚══════════════════════════════════════════════════════════╝
`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
