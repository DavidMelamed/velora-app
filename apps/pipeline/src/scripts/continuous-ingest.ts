/**
 * Continuous Data Ingestion Loop
 *
 * Cycles through all available data sources, ingesting crash data
 * in batches. Runs indefinitely. Focuses on sources with working endpoints:
 *   - ArcGIS (PA DOT) — confirmed working
 *   - Socrata (NYC, Chicago) — confirmed working, no auth needed
 *   - FARS (NHTSA) — may be rate-limited/blocked, tried as fallback
 *
 * Usage:
 *   npx tsx src/scripts/continuous-ingest.ts [--batch-size 500] [--delay-ms 3000]
 */

import 'dotenv/config'
import { runIngestion, getPipelineStatus } from '../orchestrator'
import { prisma } from '@velora/db'

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--batch-size') ?? '1000')
const DELAY_MS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--delay-ms') ?? '3000')

interface IngestJob {
  source: 'fars' | 'arcgis' | 'socrata'
  stateCode: string
  label: string
  limit: number
  fromYear?: number
  toYear?: number
  socrataDataset?: string
}

// Ordered by reliability — working sources first
const INGEST_JOBS: IngestJob[] = [
  // ── ArcGIS (PA) — fully working ──
  { source: 'arcgis', stateCode: 'PA', label: 'PA ArcGIS', limit: 2000 },

  // ── Socrata (NYC) — public, no auth ──
  { source: 'socrata', stateCode: 'NY', label: 'NYC Socrata', limit: 2000, socrataDataset: 'nyc' },

  // ── Socrata (Chicago) — public, no auth ──
  { source: 'socrata', stateCode: 'IL', label: 'Chicago Socrata', limit: 2000, socrataDataset: 'chicago' },

  // ── FARS (federal) — may be blocked, but try ──
  { source: 'fars', stateCode: 'CO', label: 'FARS CO 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'TX', label: 'FARS TX 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'CA', label: 'FARS CA 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'FL', label: 'FARS FL 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'NY', label: 'FARS NY 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'PA', label: 'FARS PA 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'OH', label: 'FARS OH 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'IL', label: 'FARS IL 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'GA', label: 'FARS GA 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'NC', label: 'FARS NC 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'MI', label: 'FARS MI 2022', limit: 500, fromYear: 2022, toYear: 2022 },
  { source: 'fars', stateCode: 'AZ', label: 'FARS AZ 2022', limit: 500, fromYear: 2022, toYear: 2022 },
]

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

let totalIngested = 0
let totalErrors = 0
let cycleCount = 0
const failedSources = new Set<string>()

// ──────────────────────────────────────────────
// Main Loop
// ──────────────────────────────────────────────

async function runCycle() {
  cycleCount++
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`[${ts()}] Cycle #${cycleCount} — ${INGEST_JOBS.length} jobs queued`)
  console.log(`${'═'.repeat(60)}`)

  for (const job of INGEST_JOBS) {
    // Skip sources that have consistently failed (retry every 5 cycles)
    if (failedSources.has(job.label) && cycleCount % 5 !== 0) {
      continue
    }

    try {
      console.log(`\n[${ts()}] ${job.label}: limit=${job.limit}`)

      const result = await runIngestion({
        source: job.source,
        stateCode: job.stateCode,
        limit: job.limit,
        dryRun: false,
        fromYear: job.fromYear,
        toYear: job.toYear,
        socrataDataset: job.socrataDataset,
      })

      totalIngested += result.goldCreated + result.goldUpdated

      if (result.bronzeCount > 0) {
        failedSources.delete(job.label) // Source is working
        console.log(`  ✓ Bronze: ${result.bronzeCount} | Silver: ${result.silverCount} | Gold: +${result.goldCreated} ~${result.goldUpdated} | Dead: ${result.deadLetterCount} | ${result.durationMs}ms`)
      } else if (result.errors.length > 0) {
        totalErrors += result.errors.length
        failedSources.add(job.label)
        console.log(`  ✗ Failed: ${result.errors[0]}`)
      } else {
        console.log(`  – No new records`)
      }
    } catch (error) {
      totalErrors++
      failedSources.add(job.label)
      console.error(`  ✗ ${job.label} error:`, (error as Error).message)
    }

    await sleep(DELAY_MS)
  }

  // Print status
  try {
    const status = await getPipelineStatus()
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`[${ts()}] Cycle #${cycleCount} complete`)
    console.log(`  DB totals: ${status.counts.crashes} crashes | ${status.counts.vehicles} vehicles | ${status.counts.persons} persons`)
    console.log(`  Session: +${totalIngested} ingested | ${totalErrors} errors`)
    if (failedSources.size > 0) {
      console.log(`  Skipping (will retry cycle ${cycleCount + 5 - (cycleCount % 5)}): ${[...failedSources].join(', ')}`)
    }
    console.log(`${'─'.repeat(60)}`)
  } catch {
    // status check failed, continue
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Velora Continuous Data Ingestion                 ║
║                                                          ║
║  Batch size: ${String(BATCH_SIZE).padEnd(6)} | Delay: ${String(DELAY_MS).padEnd(6)}ms            ║
║  Jobs: ${String(INGEST_JOBS.length).padEnd(4)} (ArcGIS, Socrata, FARS)                ║
╚══════════════════════════════════════════════════════════╝
`)

  while (true) {
    try {
      await runCycle()
    } catch (error) {
      console.error(`\n[${ts()}] Cycle failed:`, error)
    }

    const pauseSec = failedSources.size >= INGEST_JOBS.length ? 60 : 10
    console.log(`\n[${ts()}] Next cycle in ${pauseSec}s...`)
    await sleep(pauseSec * 1000)
  }
}

process.on('SIGINT', async () => {
  console.log(`\n\n[${ts()}] Shutting down...`)
  console.log(`  Total: ${totalIngested} ingested | ${totalErrors} errors | ${cycleCount} cycles`)
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
