#!/usr/bin/env tsx
/**
 * Backfill crash narratives using AI generation.
 * Usage:
 *   npx tsx src/scripts/backfill-narratives.ts --state CO --severity FATAL --limit 100 --dry-run
 */

import 'dotenv/config'
import { Command } from 'commander'
import { prisma } from '@velora/db'
import type { CrashSeverity } from '@velora/shared'

const VALID_SEVERITIES = [
  'FATAL',
  'SUSPECTED_SERIOUS_INJURY',
  'SUSPECTED_MINOR_INJURY',
  'POSSIBLE_INJURY',
  'PROPERTY_DAMAGE_ONLY',
] as const

// Approximate cost per narrative by model tier (USD)
const COST_PER_NARRATIVE: Record<string, number> = {
  FATAL: 0.15,
  SUSPECTED_SERIOUS_INJURY: 0.03,
  SUSPECTED_MINOR_INJURY: 0.005,
  POSSIBLE_INJURY: 0.005,
  PROPERTY_DAMAGE_ONLY: 0.005,
}

const program = new Command()
  .name('backfill-narratives')
  .description('Backfill crash narratives using AI generation')
  .option('--state <code>', 'State code filter (e.g., CO, PA)')
  .option('--severity <level>', `Severity filter: ${VALID_SEVERITIES.join(', ')}`)
  .option('--limit <n>', 'Maximum number of narratives to generate', '100')
  .option('--batch-size <n>', 'Batch size for processing', '20')
  .option('--delay <ms>', 'Delay between batches in ms', '5000')
  .option('--dry-run', 'Preview what would be generated without running', false)

program.action(async (opts) => {
  const stateCode = opts.state?.toUpperCase()
  const severity = opts.severity?.toUpperCase() as CrashSeverity | undefined
  const limit = parseInt(opts.limit)
  const batchSize = parseInt(opts.batchSize)
  const delayMs = parseInt(opts.delay)
  const dryRun = opts.dryRun

  // Validate severity
  if (severity && !VALID_SEVERITIES.includes(severity as (typeof VALID_SEVERITIES)[number])) {
    console.error(`Invalid severity: ${severity}. Must be one of: ${VALID_SEVERITIES.join(', ')}`)
    process.exit(1)
  }

  console.log('=== Narrative Backfill ===')
  console.log(`  State: ${stateCode || 'ALL'}`)
  console.log(`  Severity: ${severity || 'ALL'}`)
  console.log(`  Limit: ${limit}`)
  console.log(`  Batch Size: ${batchSize}`)
  console.log(`  Delay: ${delayMs}ms`)
  console.log(`  Dry Run: ${dryRun}`)
  console.log('')

  // Build query
  const where: Record<string, unknown> = {
    narratives: { none: {} },
  }
  if (stateCode) where.stateCode = stateCode
  if (severity) where.crashSeverity = severity

  // Count eligible crashes
  const eligibleCount = await prisma.crash.count({ where })
  const toProcess = Math.min(eligibleCount, limit)

  console.log(`Found ${eligibleCount} crashes without narratives`)
  console.log(`Will process: ${toProcess}`)

  if (dryRun) {
    // Estimate cost
    const crashes = await prisma.crash.findMany({
      where,
      select: { crashSeverity: true },
      take: limit,
    })

    const estimatedCost = crashes.reduce(
      (sum, c) => sum + (COST_PER_NARRATIVE[c.crashSeverity || 'PROPERTY_DAMAGE_ONLY'] || 0.005),
      0
    )

    console.log(`\nEstimated cost: $${estimatedCost.toFixed(2)}`)
    console.log('(dry run — no narratives generated)')
    await prisma.$disconnect()
    return
  }

  // Dynamic import of the generator from the API package
  // In production, this would call the API endpoint instead
  const crashes = await prisma.crash.findMany({
    where,
    select: { id: true, crashSeverity: true },
    take: limit,
    orderBy: [{ crashSeverity: 'asc' }, { crashDate: 'desc' }],
  })

  let generated = 0
  let failed = 0
  let totalCost = 0

  for (let i = 0; i < crashes.length; i += batchSize) {
    const batch = crashes.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(crashes.length / batchSize)

    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} crashes)`)

    for (const crash of batch) {
      try {
        // Call the API endpoint for narrative generation
        const apiUrl = process.env.API_URL || 'http://localhost:4000'
        const response = await fetch(`${apiUrl}/api/crashes/${crash.id}/generate-narrative`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          generated++
          totalCost += COST_PER_NARRATIVE[crash.crashSeverity || 'PROPERTY_DAMAGE_ONLY'] || 0.005
          process.stdout.write('.')
        } else {
          failed++
          const err = await response.json().catch(() => ({ error: 'Unknown' }))
          console.error(`\n  FAIL ${crash.id}: ${(err as { error: string }).error}`)
        }
      } catch (error) {
        failed++
        console.error(`\n  FAIL ${crash.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Delay between batches
    if (i + batchSize < crashes.length) {
      process.stdout.write(` (waiting ${delayMs}ms)`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  console.log('\n\n=== Results ===')
  console.log(`  Generated: ${generated}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total Cost: $${totalCost.toFixed(2)}`)

  await prisma.$disconnect()
})

program.parse()
