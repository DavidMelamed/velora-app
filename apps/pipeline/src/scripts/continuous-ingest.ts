/**
 * Continuous Data Ingestion — Smart Cursor-Based
 *
 * Tracks the last-fetched offset per dataset in the DataSource.config JSON field.
 * Each cycle fetches the NEXT page of records, never re-fetching old data.
 * When a dataset is exhausted, it waits before retrying (data grows over time).
 *
 * Usage:
 *   npx tsx src/scripts/continuous-ingest.ts [--batch-size 2000] [--delay-ms 1000]
 */

import 'dotenv/config'
import { runIngestion, getPipelineStatus } from '../orchestrator'
import { SOCRATA_DATASETS } from '../bronze/sources/socrata-adapter'
import { prisma } from '@velora/db'

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const BATCH_SIZE = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--batch-size') ?? '2000')
const DELAY_MS = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--delay-ms') ?? '1000')

interface CursorState {
  offset: number
  exhausted: boolean
  exhaustedAt?: string
  totalIngested: number
}

// ──────────────────────────────────────────────
// Cursor Management
// ──────────────────────────────────────────────

async function getCursor(dataSourceName: string): Promise<CursorState> {
  const ds = await prisma.dataSource.findUnique({
    where: { name: dataSourceName },
    select: { config: true },
  })

  const config = (ds?.config as Record<string, unknown>) ?? {}
  return {
    offset: (config.cursor_offset as number) ?? 0,
    exhausted: (config.cursor_exhausted as boolean) ?? false,
    exhaustedAt: config.cursor_exhausted_at as string | undefined,
    totalIngested: (config.cursor_total_ingested as number) ?? 0,
  }
}

async function saveCursor(dataSourceName: string, cursor: CursorState): Promise<void> {
  await prisma.dataSource.upsert({
    where: { name: dataSourceName },
    create: {
      name: dataSourceName,
      type: 'SOCRATA',
      isActive: true,
      config: {
        cursor_offset: cursor.offset,
        cursor_exhausted: cursor.exhausted,
        cursor_exhausted_at: cursor.exhaustedAt,
        cursor_total_ingested: cursor.totalIngested,
      },
    },
    update: {
      config: {
        cursor_offset: cursor.offset,
        cursor_exhausted: cursor.exhausted,
        cursor_exhausted_at: cursor.exhaustedAt,
        cursor_total_ingested: cursor.totalIngested,
      },
    },
  })
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19)
}

let totalNewRecords = 0
let totalSkipped = 0
let cycleCount = 0

// ──────────────────────────────────────────────
// Main Loop
// ──────────────────────────────────────────────

async function runCycle() {
  cycleCount++
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`[${ts()}] Cycle #${cycleCount} — ${SOCRATA_DATASETS.length} datasets`)
  console.log(`${'═'.repeat(60)}`)

  let datasetsExhausted = 0

  for (const dataset of SOCRATA_DATASETS) {
    const dsName = `socrata-${dataset.stateCode.toLowerCase()}-${dataset.name}`
    const cursor = await getCursor(dsName)

    // If exhausted, check if enough time has passed to retry (1 hour)
    if (cursor.exhausted) {
      const exhaustedAt = cursor.exhaustedAt ? new Date(cursor.exhaustedAt) : new Date()
      const hoursSinceExhausted = (Date.now() - exhaustedAt.getTime()) / (1000 * 60 * 60)

      if (hoursSinceExhausted < 1) {
        datasetsExhausted++
        continue // Skip — check again later
      }
      // Enough time passed, retry from the exhausted offset
      console.log(`\n[${ts()}] ${dataset.name}: retrying after ${hoursSinceExhausted.toFixed(1)}h pause (offset=${cursor.offset})`)
    }

    try {
      console.log(`\n[${ts()}] ${dataset.name}: offset=${cursor.offset} (${cursor.totalIngested} total so far)`)

      const result = await runIngestion({
        source: 'socrata',
        stateCode: dataset.stateCode,
        limit: BATCH_SIZE,
        dryRun: false,
        socrataDataset: dataset.name,
        startOffset: cursor.offset,
      })

      if (result.goldCreated > 0) {
        // New records found — advance cursor
        const newOffset = cursor.offset + result.bronzeCount
        const newTotal = cursor.totalIngested + result.goldCreated
        await saveCursor(dsName, {
          offset: newOffset,
          exhausted: false,
          totalIngested: newTotal,
        })
        totalNewRecords += result.goldCreated
        console.log(`  ✓ NEW: +${result.goldCreated} created, ${result.goldUpdated} updated | offset→${newOffset} | total: ${newTotal}`)
      } else if (result.bronzeCount === 0) {
        // Dataset exhausted — no more records at this offset
        await saveCursor(dsName, {
          ...cursor,
          exhausted: true,
          exhaustedAt: new Date().toISOString(),
        })
        datasetsExhausted++
        console.log(`  ○ Exhausted at offset=${cursor.offset} (${cursor.totalIngested} total)`)
      } else if (result.goldUpdated > 0 && result.goldCreated === 0) {
        // All records were duplicates — advance cursor to skip them
        const newOffset = cursor.offset + result.bronzeCount
        await saveCursor(dsName, {
          ...cursor,
          offset: newOffset,
        })
        totalSkipped += result.goldUpdated
        console.log(`  ~ Dupes: ${result.goldUpdated} already existed | offset→${newOffset}`)
      } else if (result.errors.length > 0) {
        console.log(`  ✗ Error: ${result.errors[0]}`)
      }
    } catch (error) {
      console.error(`  ✗ ${dataset.name} error:`, (error as Error).message)
    }

    await sleep(DELAY_MS)
  }

  // Print status
  try {
    const status = await getPipelineStatus()
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`[${ts()}] Cycle #${cycleCount} complete`)
    console.log(`  DB totals: ${status.counts.crashes} crashes | ${status.counts.vehicles} vehicles | ${status.counts.persons} persons`)
    console.log(`  Session: +${totalNewRecords} new | ${totalSkipped} skipped dupes`)
    console.log(`  Datasets: ${datasetsExhausted}/${SOCRATA_DATASETS.length} exhausted (will retry in 1h)`)
    console.log(`${'─'.repeat(60)}`)
  } catch {
    // status check failed, continue
  }

  return datasetsExhausted
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         Velora Smart Data Ingestion                      ║
║                                                          ║
║  Batch size: ${String(BATCH_SIZE).padEnd(6)} | Delay: ${String(DELAY_MS).padEnd(6)}ms            ║
║  Datasets: ${String(SOCRATA_DATASETS.length).padEnd(4)} Socrata sources                       ║
║  Mode: Cursor-based (only fetches NEW records)           ║
╚══════════════════════════════════════════════════════════╝
`)

  console.log('Datasets:')
  for (const ds of SOCRATA_DATASETS) {
    const dsName = `socrata-${ds.stateCode.toLowerCase()}-${ds.name}`
    const cursor = await getCursor(dsName)
    console.log(`  • ${ds.name} (${ds.stateCode}): offset=${cursor.offset}, total=${cursor.totalIngested}${cursor.exhausted ? ' [EXHAUSTED]' : ''}`)
  }
  console.log()

  while (true) {
    try {
      const exhaustedCount = await runCycle()

      // If ALL datasets are exhausted, wait longer (30 min)
      if (exhaustedCount >= SOCRATA_DATASETS.length) {
        console.log(`\n[${ts()}] All datasets exhausted. Waiting 30 min for new data...`)
        await sleep(30 * 60 * 1000)
      } else {
        // Short pause between cycles
        console.log(`\n[${ts()}] Next cycle in 5s...`)
        await sleep(5000)
      }
    } catch (error) {
      console.error(`\n[${ts()}] Cycle failed:`, error)
      await sleep(10000)
    }
  }
}

process.on('SIGINT', async () => {
  console.log(`\n\n[${ts()}] Shutting down...`)
  console.log(`  Total new: ${totalNewRecords} | Skipped dupes: ${totalSkipped} | Cycles: ${cycleCount}`)
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
