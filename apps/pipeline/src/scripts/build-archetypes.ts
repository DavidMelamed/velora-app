#!/usr/bin/env tsx
/**
 * Build crash archetypes via k-means clustering.
 *
 * Usage:
 *   pnpm tsx src/scripts/build-archetypes.ts --state CO --clusters 25 --dry-run
 *
 * This script imports the archetype service from the API package at runtime.
 * It must be run from the monorepo root or with proper path resolution.
 */

import { Command } from 'commander'
import { prisma } from '@velora/db'

interface ArchetypeResult {
  id: string
  name: string
  stateCode: string | null
  crashCount: number
  avgSeverity: number
  fatalityRate: number
}

const program = new Command()

program
  .name('build-archetypes')
  .description('Cluster crashes into archetypes using k-means on 9-dimension feature vectors')
  .option('-s, --state <code>', 'State code to cluster (e.g., CO). Omit for all states.')
  .option('-k, --clusters <number>', 'Number of clusters (default: 25)', '25')
  .option('--dry-run', 'Preview without persisting to database', false)
  .action(async (opts) => {
    const stateCode: string | undefined = opts.state?.toUpperCase()
    const k = parseInt(opts.clusters, 10)
    const dryRun: boolean = opts.dryRun

    console.log(`[build-archetypes] Starting...`)
    console.log(`  State: ${stateCode ?? 'ALL'}`)
    console.log(`  Clusters: ${k}`)
    console.log(`  Dry run: ${dryRun}`)

    // Count available crashes
    const where = stateCode ? { stateCode } : {}
    const crashCount = await prisma.crash.count({ where })
    console.log(`  Crashes found: ${crashCount}`)

    if (crashCount === 0) {
      console.log('[build-archetypes] No crashes found. Exiting.')
      process.exit(0)
    }

    if (crashCount < k) {
      console.log(`[build-archetypes] Warning: Only ${crashCount} crashes, will adjust k to ${Math.max(1, Math.floor(crashCount / 3))}`)
    }

    if (dryRun) {
      console.log('[build-archetypes] Dry run complete. No data written.')
      process.exit(0)
    }

    // Clear existing archetypes for this state before re-clustering
    if (stateCode) {
      const deleted = await prisma.crashArchetype.deleteMany({ where: { stateCode } })
      console.log(`  Cleared ${deleted.count} existing archetypes for ${stateCode}`)
    } else {
      const deleted = await prisma.crashArchetype.deleteMany({})
      console.log(`  Cleared ${deleted.count} existing archetypes`)
    }

    // Dynamic import to cross package boundary at runtime (not type-checked)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archetypeService = require('../../../../apps/api/src/services/crash-archetype-service') as {
      clusterCrashArchetypes: (stateCode?: string, k?: number) => Promise<ArchetypeResult[]>
    }

    const archetypes = await archetypeService.clusterCrashArchetypes(stateCode, k)

    console.log(`\n[build-archetypes] Created ${archetypes.length} archetypes:`)
    for (const arch of archetypes) {
      console.log(`  - ${arch.name}: ${arch.crashCount} crashes, avg severity ${arch.avgSeverity.toFixed(2)}, fatality rate ${(arch.fatalityRate * 100).toFixed(1)}%`)
    }

    console.log('\n[build-archetypes] Done.')
    process.exit(0)
  })

program.parse()
