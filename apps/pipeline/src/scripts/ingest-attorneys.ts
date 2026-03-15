#!/usr/bin/env tsx
/**
 * Attorney Ingestion Script
 *
 * Discovers personal injury lawyers nationwide via DataForSEO Google Maps API,
 * fetches their reviews, and publishes to the database.
 *
 * Usage:
 *   npx tsx apps/pipeline/src/scripts/ingest-attorneys.ts [options]
 *
 * Options:
 *   --state XX        Only process one state (e.g., --state CA)
 *   --city "Name"     Only process one city (requires --state)
 *   --dry-run         Print what would be done without API calls
 *   --max-reviews N   Max reviews per attorney (default: 100)
 *   --delay-ms N      Delay between API calls in ms (default: 500)
 *
 * Required env vars:
 *   DATAFORSEO_LOGIN     DataForSEO API login email
 *   DATAFORSEO_PASSWORD  DataForSEO API password
 *   DATABASE_URL         PostgreSQL connection string
 */

import { STATE_CATALOG } from '@velora/shared'
import {
  discoverAttorneysWithReviews,
  TOP_CITIES_BY_STATE,
  type DataForSEOConfig,
} from '../bronze/sources/dataforseo-adapter'
import { publishAttorneys } from '../gold/attorney-publisher'

interface CliArgs {
  state?: string
  city?: string
  dryRun: boolean
  maxReviews: number
  delayMs: number
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = {
    dryRun: false,
    maxReviews: 100,
    delayMs: 500,
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
    }
  }

  return result
}

async function main() {
  const args = parseArgs()

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD

  if (!login || !password) {
    console.error('Missing DATAFORSEO_LOGIN and/or DATAFORSEO_PASSWORD env vars')
    console.error('Sign up at https://dataforseo.com/ and set these in .env')
    process.exit(1)
  }

  const config: DataForSEOConfig = {
    login,
    password,
    rateLimitMs: args.delayMs,
  }

  // Determine which states/cities to process
  const statesToProcess = args.state
    ? STATE_CATALOG.filter((s) => s.code === args.state)
    : STATE_CATALOG

  if (statesToProcess.length === 0) {
    console.error(`Unknown state code: ${args.state}`)
    process.exit(1)
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalReviews = 0
  let totalErrors = 0

  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Velora Attorney Ingestion Pipeline              ║
║                                                          ║
║  States: ${statesToProcess.length.toString().padEnd(5)}  | Dry run: ${args.dryRun.toString().padEnd(10)}        ║
║  Max reviews/attorney: ${args.maxReviews.toString().padEnd(5)} | Delay: ${args.delayMs}ms          ║
╚══════════════════════════════════════════════════════════╝
`)

  for (const state of statesToProcess) {
    const cities = args.city
      ? [args.city]
      : TOP_CITIES_BY_STATE[state.code] ?? [state.name]

    console.log(`\n━━━ ${state.name} (${state.code}) — ${cities.length} cities ━━━`)

    for (const city of cities) {
      console.log(`\n  📍 ${city}, ${state.code}`)

      if (args.dryRun) {
        console.log(`    [DRY RUN] Would search for PI lawyers in ${city}, ${state.name}`)
        continue
      }

      try {
        const results = await discoverAttorneysWithReviews(config, {
          city,
          stateCode: state.code,
          stateName: state.name,
        }, {
          maxReviewsPerListing: args.maxReviews,
        })

        if (results.length === 0) {
          console.log(`    No attorneys found`)
          continue
        }

        console.log(`    Found ${results.length} attorneys, ${results.reduce((sum, r) => sum + r.reviews.length, 0)} total reviews`)

        const publishResult = await publishAttorneys(results, {
          city,
          stateCode: state.code,
        })

        totalCreated += publishResult.created
        totalUpdated += publishResult.updated
        totalReviews += publishResult.reviewsAdded
        totalErrors += publishResult.errors.length

        console.log(`    ✓ Created: ${publishResult.created}, Updated: ${publishResult.updated}, Reviews: ${publishResult.reviewsAdded}`)

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
  }

  console.log(`
╔══════════════════════════════════════════════════════════╗
║  Ingestion Complete                                      ║
║                                                          ║
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
