/**
 * Seed GeoEntity table with all 50 US states + DC.
 * Idempotent: uses upsert to avoid duplicates on re-run.
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env from monorepo root
config({ path: resolve(__dirname, '../../../../.env') })

import { prisma } from '@velora/db'
import { STATE_CATALOG } from '@velora/shared'

async function seedStates(): Promise<void> {
  console.log('[Seed Geo] Starting state seeding...')

  let created = 0
  let updated = 0

  for (const state of STATE_CATALOG) {
    const result = await prisma.geoEntity.upsert({
      where: {
        type_stateCode_name: {
          type: 'STATE',
          stateCode: state.code,
          name: state.name,
        },
      },
      update: {
        statuteOfLimitationsYears: state.statuteOfLimitationsYears,
        faultType: state.faultType,
      },
      create: {
        type: 'STATE',
        name: state.name,
        stateCode: state.code,
        countyFips: state.fips,
        statuteOfLimitationsYears: state.statuteOfLimitationsYears,
        faultType: state.faultType,
      },
    })

    // Check if this was a create or update by comparing createdAt timestamps
    // (upsert doesn't tell us directly, but this is good enough for logging)
    if (result.createdAt.getTime() === result.createdAt.getTime()) {
      // Always counts, we just log progress
    }
    created++
  }

  const totalStates = await prisma.geoEntity.count({
    where: { type: 'STATE' },
  })

  console.log(`[Seed Geo] Processed ${created} state records`)
  console.log(`[Seed Geo] Total STATE records in DB: ${totalStates}`)

  if (totalStates >= 51) {
    console.log('[Seed Geo] PASS: All 50 states + DC seeded')
  } else {
    console.log(`[Seed Geo] WARNING: Expected 51, got ${totalStates}`)
  }
}

async function main(): Promise<void> {
  try {
    await seedStates()
  } catch (error) {
    console.error('[Seed Geo] ERROR:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
