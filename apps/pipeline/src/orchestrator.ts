/**
 * Pipeline orchestrator — Bronze → Silver → Gold in one flow.
 * Tracks PipelineRun and DataSource records.
 */

import { prisma } from '@velora/db'
import { fetchFARSCrashes } from './bronze/sources/fars-adapter'
import { fetchArcGISCrashes } from './bronze/sources/arcgis-adapter'
import { mapBronzeToSilver } from './silver/mapper'
import { writeDeadLetters } from './silver/dead-letter'
import { publishToGold } from './gold/publisher'
import { deduplicateBatch } from './gold/dedup'
import { getArcGISConfig } from './config/arcgis-states'
import type { BronzeRecord } from './bronze/types'

export interface IngestOptions {
  source: 'fars' | 'arcgis'
  stateCode: string
  limit: number
  dryRun: boolean
  fromYear?: number
  toYear?: number
}

export interface IngestResult {
  pipelineRunId: string | null
  bronzeCount: number
  silverCount: number
  goldCreated: number
  goldUpdated: number
  deadLetterCount: number
  durationMs: number
  errors: string[]
}

/**
 * Run the full Bronze → Silver → Gold pipeline for a given source and state.
 */
export async function runIngestion(options: IngestOptions): Promise<IngestResult> {
  const startTime = Date.now()
  const errors: string[] = []

  console.log(`\n[Pipeline] Starting ingestion: source=${options.source} state=${options.stateCode} limit=${options.limit} dryRun=${options.dryRun}`)

  // Ensure DataSource record exists
  const dataSource = await prisma.dataSource.upsert({
    where: { name: `${options.source}-${options.stateCode.toLowerCase()}` },
    create: {
      name: `${options.source}-${options.stateCode.toLowerCase()}`,
      type: options.source.toUpperCase(),
      stateCode: options.stateCode,
      isActive: true,
    },
    update: {},
  })

  // Create PipelineRun
  let pipelineRun = await prisma.pipelineRun.create({
    data: {
      dataSourceId: dataSource.id,
      stage: 'BRONZE',
      status: 'RUNNING',
    },
  })

  try {
    // ═══════════ BRONZE STAGE ═══════════
    console.log('\n[Bronze] Fetching records...')
    const bronzeRecords: BronzeRecord[] = []

    if (options.source === 'fars') {
      const currentYear = new Date().getFullYear()
      const gen = fetchFARSCrashes({
        stateCode: options.stateCode,
        fromYear: options.fromYear ?? currentYear - 2,
        toYear: options.toYear ?? currentYear - 1,
        batchSize: 5,
        limit: options.limit,
        rateLimitMs: 500,
      })
      for await (const record of gen) {
        bronzeRecords.push(record)
        if (bronzeRecords.length >= options.limit) break
      }
    } else if (options.source === 'arcgis') {
      const config = getArcGISConfig(options.stateCode)
      if (!config) {
        throw new Error(`No ArcGIS config found for state ${options.stateCode}`)
      }
      const gen = fetchArcGISCrashes({
        stateCode: options.stateCode,
        endpoint: config.endpoint,
        layerId: config.layerId,
        dateField: config.dateField,
        batchSize: config.batchSize,
        fieldMapping: {},
        limit: options.limit,
      })
      for await (const record of gen) {
        bronzeRecords.push(record)
        if (bronzeRecords.length >= options.limit) break
      }
    }

    console.log(`[Bronze] Fetched ${bronzeRecords.length} records`)

    // Update pipeline run
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        recordsIn: bronzeRecords.length,
        stage: 'SILVER',
      },
    })

    if (bronzeRecords.length === 0) {
      await prisma.pipelineRun.update({
        where: { id: pipelineRun.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          recordsOut: 0,
        },
      })

      return {
        pipelineRunId: pipelineRun.id,
        bronzeCount: 0,
        silverCount: 0,
        goldCreated: 0,
        goldUpdated: 0,
        deadLetterCount: 0,
        durationMs: Date.now() - startTime,
        errors: ['No records fetched from source'],
      }
    }

    // ═══════════ SILVER STAGE ═══════════
    console.log('\n[Silver] Mapping and validating...')
    const silverResult = mapBronzeToSilver(bronzeRecords)

    console.log(`[Silver] Passed: ${silverResult.metrics.passed}, Failed: ${silverResult.metrics.failed}`)

    // Write dead letters
    if (silverResult.deadLetters.length > 0 && !options.dryRun) {
      await writeDeadLetters(silverResult.deadLetters, dataSource.id)
    }

    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        stage: 'GOLD',
        recordsOut: silverResult.metrics.passed,
        recordsFailed: silverResult.metrics.failed,
      },
    })

    if (options.dryRun) {
      console.log('\n[Pipeline] DRY RUN — skipping Gold stage')

      await prisma.pipelineRun.update({
        where: { id: pipelineRun.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
        },
      })

      return {
        pipelineRunId: pipelineRun.id,
        bronzeCount: bronzeRecords.length,
        silverCount: silverResult.metrics.passed,
        goldCreated: 0,
        goldUpdated: 0,
        deadLetterCount: silverResult.metrics.failed,
        durationMs: Date.now() - startTime,
        errors: [],
      }
    }

    // ═══════════ GOLD STAGE ═══════════
    console.log('\n[Gold] Deduplicating and publishing...')

    // Deduplicate
    const dedupInput = silverResult.success.map(r => ({
      crash: r.crash,
      vehicleCount: r.vehicles.length,
    }))
    const { keepIndices, dupIndices } = deduplicateBatch(dedupInput)
    console.log(`[Gold] After dedup: ${keepIndices.length} unique, ${dupIndices.length} duplicates`)

    // Publish
    const toPublish = keepIndices.map(i => ({
      crash: silverResult.success[i].crash,
      vehicles: silverResult.success[i].vehicles,
      persons: silverResult.success[i].persons,
      rawData: bronzeRecords[i]?.rawData as Record<string, unknown>,
    }))

    const publishResult = await publishToGold(toPublish)

    // Update pipeline run
    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        recordsOut: publishResult.created + publishResult.updated,
        errorLog: publishResult.errors.length > 0 ? publishResult.errors : undefined,
      },
    })

    // Update data source
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: {
        lastFetchedAt: new Date(),
        lastRecordCount: publishResult.created + publishResult.updated,
      },
    })

    const duration = Date.now() - startTime
    console.log(`\n[Pipeline] Complete in ${duration}ms`)
    console.log(`  Bronze: ${bronzeRecords.length}`)
    console.log(`  Silver: ${silverResult.metrics.passed} passed, ${silverResult.metrics.failed} failed`)
    console.log(`  Gold: ${publishResult.created} created, ${publishResult.updated} updated`)

    return {
      pipelineRunId: pipelineRun.id,
      bronzeCount: bronzeRecords.length,
      silverCount: silverResult.metrics.passed,
      goldCreated: publishResult.created,
      goldUpdated: publishResult.updated,
      deadLetterCount: silverResult.metrics.failed,
      durationMs: duration,
      errors: publishResult.errors.map(e => `${e.stateUniqueId}: ${e.error}`),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Pipeline] FAILED: ${errorMsg}`)

    await prisma.pipelineRun.update({
      where: { id: pipelineRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorLog: { error: errorMsg },
      },
    })

    // Update error count on data source
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: {
        errorCount: { increment: 1 },
        lastError: errorMsg,
      },
    })

    return {
      pipelineRunId: pipelineRun.id,
      bronzeCount: 0,
      silverCount: 0,
      goldCreated: 0,
      goldUpdated: 0,
      deadLetterCount: 0,
      durationMs: Date.now() - startTime,
      errors: [errorMsg],
    }
  }
}

/**
 * Get pipeline status summary.
 */
export async function getPipelineStatus(): Promise<{
  dataSources: Array<{ name: string; type: string; lastFetched: Date | null; errorCount: number }>
  recentRuns: Array<{ id: string; source: string; stage: string; status: string; recordsIn: number; recordsOut: number; startedAt: Date }>
  counts: { crashes: number; vehicles: number; persons: number; deadLetters: number }
}> {
  const [dataSources, recentRuns, crashCount, vehicleCount, personCount, deadLetterCount] = await Promise.all([
    prisma.dataSource.findMany({
      select: { name: true, type: true, lastFetchedAt: true, errorCount: true },
    }),
    prisma.pipelineRun.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
      include: { dataSource: { select: { name: true } } },
    }),
    prisma.crash.count(),
    prisma.vehicle.count(),
    prisma.person.count(),
    prisma.pipelineDeadLetter.count(),
  ])

  return {
    dataSources: dataSources.map(ds => ({
      name: ds.name,
      type: ds.type,
      lastFetched: ds.lastFetchedAt,
      errorCount: ds.errorCount,
    })),
    recentRuns: recentRuns.map(r => ({
      id: r.id,
      source: r.dataSource.name,
      stage: r.stage,
      status: r.status,
      recordsIn: r.recordsIn,
      recordsOut: r.recordsOut,
      startedAt: r.startedAt,
    })),
    counts: {
      crashes: crashCount,
      vehicles: vehicleCount,
      persons: personCount,
      deadLetters: deadLetterCount,
    },
  }
}
