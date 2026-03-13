import { Command } from 'commander'
import { runIngestion, getPipelineStatus } from './orchestrator'
import { prisma } from '@velora/db'

const program = new Command()

program
  .name('velora-pipeline')
  .description('Velora data pipeline — Bronze/Silver/Gold medallion architecture')
  .version('0.0.0')

program
  .command('ingest')
  .description('Run data ingestion for a source')
  .requiredOption('-s, --source <source>', 'Data source (fars, arcgis, socrata)')
  .option('--state <stateCode>', '2-letter state code', 'CO')
  .option('--limit <limit>', 'Max records to ingest', '100')
  .option('--from-year <year>', 'Start year for FARS data')
  .option('--to-year <year>', 'End year for FARS data')
  .option('--dataset <name>', 'Socrata dataset name (e.g. nyc, chicago)')
  .option('--dry-run', 'Run without writing to Gold database', false)
  .action(async (options) => {
    try {
      const result = await runIngestion({
        source: options.source as 'fars' | 'arcgis' | 'socrata',
        stateCode: options.state,
        limit: parseInt(options.limit),
        dryRun: options.dryRun,
        fromYear: options.fromYear ? parseInt(options.fromYear) : undefined,
        toYear: options.toYear ? parseInt(options.toYear) : undefined,
        socrataDataset: options.dataset,
      })

      console.log('\n═══════════════════════════════════')
      console.log('Pipeline Result:')
      console.log(`  Run ID: ${result.pipelineRunId}`)
      console.log(`  Bronze: ${result.bronzeCount} records fetched`)
      console.log(`  Silver: ${result.silverCount} validated`)
      console.log(`  Gold: ${result.goldCreated} created, ${result.goldUpdated} updated`)
      console.log(`  Dead letters: ${result.deadLetterCount}`)
      console.log(`  Duration: ${result.durationMs}ms`)
      if (result.errors.length > 0) {
        console.log(`  Errors (${result.errors.length}):`)
        result.errors.slice(0, 5).forEach(e => console.log(`    - ${e}`))
      }
      console.log('═══════════════════════════════════\n')
    } catch (error) {
      console.error('Pipeline failed:', error)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

program
  .command('validate')
  .description('Run quality gates on ingested data')
  .option('--state <stateCode>', '2-letter state code')
  .action(async (options) => {
    try {
      const { runAllQualityGates } = await import('./validation/quality-gates')
      const results = await runAllQualityGates(options.state)

      console.log('\n═══════════════════════════════════')
      console.log(`Quality Gates Report${options.state ? ` (${options.state})` : ''}:`)
      console.log('═══════════════════════════════════')

      let passCount = 0
      let failCount = 0
      for (const result of results) {
        const status = result.passed ? 'PASS' : 'FAIL'
        if (result.passed) passCount++
        else failCount++
        console.log(`  [${status}] ${result.gate}: ${result.message}`)
        console.log(`         Expected: ${result.expected} | Actual: ${result.actual}`)
      }

      console.log('───────────────────────────────────')
      console.log(`  Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount}`)
      console.log('═══════════════════════════════════\n')
    } catch (error) {
      console.error('Validation failed:', error)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

program
  .command('status')
  .description('Show pipeline status')
  .action(async () => {
    try {
      const status = await getPipelineStatus()

      console.log('\n═══════════════════════════════════')
      console.log('Pipeline Status')
      console.log('═══════════════════════════════════')

      console.log('\nData Counts:')
      console.log(`  Crashes: ${status.counts.crashes}`)
      console.log(`  Vehicles: ${status.counts.vehicles}`)
      console.log(`  Persons: ${status.counts.persons}`)
      console.log(`  Dead Letters: ${status.counts.deadLetters}`)

      if (status.dataSources.length > 0) {
        console.log('\nData Sources:')
        for (const ds of status.dataSources) {
          console.log(`  ${ds.name} (${ds.type}): last fetched ${ds.lastFetched ?? 'never'}, errors: ${ds.errorCount}`)
        }
      }

      if (status.recentRuns.length > 0) {
        console.log('\nRecent Runs:')
        for (const run of status.recentRuns.slice(0, 5)) {
          console.log(`  ${run.id.substring(0, 8)}... | ${run.source} | ${run.stage} | ${run.status} | in:${run.recordsIn} out:${run.recordsOut} | ${run.startedAt.toISOString()}`)
        }
      } else {
        console.log('\nNo pipeline runs recorded')
      }

      console.log('═══════════════════════════════════\n')
    } catch (error) {
      console.error('Status check failed:', error)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

program.parse()
